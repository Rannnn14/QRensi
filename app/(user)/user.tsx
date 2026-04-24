import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from "react-native"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { AppTheme } from "../../constants/theme"
import { SectionHeader } from "../../components/ui/section-header"
import { getLocalDateValue } from "../../lib/date"
import { prepareNotifications, sendLocalNotification } from "../../lib/notifications"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import {
  formatSubmissionTime,
  getDefaultAttendanceStatus,
  getSubmissionDisplayType,
  getSubmissionStatusLabel,
  isTodaySubmission,
  PASSWORD_REQUEST_TYPE,
} from "../../lib/pengajuan"

type ProfileState = {
  name: string
  kelas: string
}

type AttendanceState = {
  status: string
  waktu: string
}

type SubmissionState = {
  id: string
  jenis: string
  status: string
  created_at: string
}

const quickActions = [
  {
    title: "Riwayat Kehadiran",
    description: "Lihat catatan presensi sebelumnya",
    icon: "time-outline" as const,
    action: () => router.push("/riwayat_kehadiran" as any),
  },
  {
    title: "Ajukan Izin",
    description: "Izin, sakit, dan riwayat pengajuan",
    icon: "document-text-outline" as const,
    action: () => router.push("/ajuan" as any),
  },
  {
    title: "Lihat Kode QR",
    description: "Unduh kartu untuk cetak",
    icon: "qr-code-outline" as const,
    action: () => router.push("/generate_qr" as any),
  },
  {
    title: "Status Kehadiran",
    description: "Lihat hasil hari ini",
    icon: "checkmark-done-outline" as const,
    action: () => router.push("/status_kehadiran" as any),
  },
]

export default function User() {
  const [profile, setProfile] = useState<ProfileState>({ name: "", kelas: "-" })
  const [attendance, setAttendance] = useState<AttendanceState>({ status: getDefaultAttendanceStatus(), waktu: "--:--" })
  const [refreshing, setRefreshing] = useState(false)
  const [todaySubmissions, setTodaySubmissions] = useState<SubmissionState[]>([])

  useEffect(() => {
    prepareNotifications()
    let profileChannel: any = null
    let attendanceChannel: any = null
    let submissionChannel: any = null

    const loadTodaySubmissions = async (userId: string) => {
      const { data: submissionData } = await supabaseAdmin
        .from("pengajuan")
        .select("id, jenis, status, created_at")
        .eq("user_id", userId)
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false })

      const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
      setTodaySubmissions(filtered as SubmissionState[])
    }

    const applyFallbackAttendance = () => {
      const fallbackStatus = getDefaultAttendanceStatus()
      setAttendance((prev) =>
        prev.status === "Belum Absen" || prev.status === "Tidak Hadir"
          ? { ...prev, status: fallbackStatus }
          : prev
      )
      setTodaySubmissions((prev) => prev.filter((item) => isTodaySubmission(item.created_at)))
    }

    const loadDashboard = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) return

      const fallbackName = user.email ? user.email.split("@")[0] : "User"
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nama, kelas")
        .eq("id", user.id)
        .single()

      setProfile({
        name: profileData?.nama || fallbackName,
        kelas: profileData?.kelas || "-",
      })

      const today = getLocalDateValue()
      const { data: attendanceData } = await supabaseAdmin
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .maybeSingle()

      setAttendance({
        status: attendanceData?.status || getDefaultAttendanceStatus(),
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      await loadTodaySubmissions(user.id)

      profileChannel = supabase
        .channel("realtime-user-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload: { new?: { nama?: string; kelas?: string } }) => {
            setProfile((prev) => ({
              name: payload.new?.nama || prev.name,
              kelas: payload.new?.kelas || prev.kelas,
            }))
          }
        )
        .subscribe()

      attendanceChannel = supabase
        .channel("realtime-attendance-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "absensi", filter: `user_id=eq.${user.id}` },
          (payload: { new?: { status?: string; created_at?: string; tanggal?: string } }) => {
            if (payload.new?.tanggal !== getLocalDateValue()) return

            const latestTime = payload.new?.created_at
              ? new Date(payload.new.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"

            setAttendance({
              status: payload.new?.status || getDefaultAttendanceStatus(),
              waktu: latestTime,
            })
            sendLocalNotification(
              "Update kehadiran",
              `Status kamu sekarang ${payload.new?.status || getDefaultAttendanceStatus()} pada ${latestTime}.`
            )
          }
        )
        .subscribe()

      submissionChannel = supabase
        .channel("realtime-submission-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pengajuan", filter: `user_id=eq.${user.id}` },
          () => {
            loadTodaySubmissions(user.id)
          }
        )
        .subscribe()
    }

    loadDashboard()
    const cutoffWatcher = setInterval(applyFallbackAttendance, 30000)

    return () => {
      clearInterval(cutoffWatcher)
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (attendanceChannel) supabase.removeChannel(attendanceChannel)
      if (submissionChannel) supabase.removeChannel(submissionChannel)
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (user) {
      const fallbackName = user.email ? user.email.split("@")[0] : "User"
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nama, kelas")
        .eq("id", user.id)
        .single()

      setProfile({
        name: profileData?.nama || fallbackName,
        kelas: profileData?.kelas || "-",
      })

      const today = getLocalDateValue()
      const { data: attendanceData } = await supabaseAdmin
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .maybeSingle()

      setAttendance({
        status: attendanceData?.status || getDefaultAttendanceStatus(),
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      const { data: submissionData } = await supabaseAdmin
        .from("pengajuan")
        .select("id, jenis, status, created_at")
        .eq("user_id", user.id)
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false })

      const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
      setTodaySubmissions(filtered as SubmissionState[])
    }
    setRefreshing(false)
  }

  const normalizedStatus = attendance.status.toLowerCase()

  const statusColor =
    normalizedStatus === "hadir"
      ? "#1e8c5d"
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? "#ba7412"
        : normalizedStatus === "tidak hadir"
          ? AppTheme.colors.danger
          : "#22405f"

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.topCopy}>
            <Text style={styles.brand}>QRensi</Text>
            <Text style={styles.subtitle}>Student dashboard</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onRefresh} disabled={refreshing}>
              <Ionicons
                name={refreshing ? "hourglass-outline" : "refresh-outline"}
                size={18}
                color="#22405f"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await supabase.auth.signOut()
                router.replace("/login")
              }}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View>
            <Text style={styles.mutedLabel}>Profil Siswa</Text>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>Kelas {profile.kelas}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Aktif</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.noticeCard} onPress={() => router.push("/ajuan" as any)}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Riwayat Pengajuan Hari Ini</Text>
            <Text style={styles.noticeMeta}>{todaySubmissions.length} item</Text>
          </View>
          {todaySubmissions.length === 0 ? (
            <Text style={styles.noticeEmpty}>
              Belum ada pengajuan hari ini. Riwayat di kartu ini akan otomatis kosong saat berganti hari.
            </Text>
          ) : (
            todaySubmissions.map((item) => (
              <View key={item.id} style={styles.noticeItem}>
                <View style={styles.noticeIconWrap}>
                  <Ionicons name="document-text-outline" size={16} color="#16324f" />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeItemTitle}>{getSubmissionDisplayType(item.jenis)}</Text>
                  <Text style={styles.noticeText}>
                    Status: {getSubmissionStatusLabel(item.status)}
                  </Text>
                  <Text style={styles.noticeText}>
                    Jam pengajuan: {formatSubmissionTime(item.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => router.push("/status_kehadiran" as any)}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Kehadiran hari ini</Text>
            <Text style={styles.heroTime}>
              {attendance.waktu === "--:--" ? "Belum check-in" : `Check-in ${attendance.waktu}`}
            </Text>
          </View>
          <View style={styles.heroStatusPill}>
            <Text style={styles.heroStatusText}>{attendance.status}</Text>
          </View>
          <Text style={styles.heroHelper}>
            Ringkasan status kehadiran tampil otomatis dan terhubung real-time.
          </Text>
        </TouchableOpacity>

        <View style={styles.quickSection}>
          <SectionHeader title="Akses cepat" hint="Jalur utama untuk aktivitas siswa" />
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={styles.quickCard}
                onPress={item.action}
              >
                <View style={styles.quickIconWrap}>
                  <Ionicons name={item.icon} size={18} color="#22405f" />
                </View>
                <Text style={styles.quickTitle}>{item.title}</Text>
                <Text style={styles.quickDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Ringkasan Hari Ini</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailValue, { color: statusColor }]}>{attendance.status}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Kelas</Text>
            <Text style={styles.detailValue}>{profile.kelas}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Metode</Text>
            <Text style={styles.detailValue}>Scan QR</Text>
          </View>
        </View>

      </ScrollView>
      <UserBottomNav activeKey="user" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: AppTheme.spacing.lg,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: 28,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  topCopy: {
    flex: 1,
    minWidth: 150,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  brand: {
    ...AppTheme.typography.display,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: AppTheme.colors.textMuted,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: AppTheme.radius.sm,
  },
  logoutText: {
    color: AppTheme.colors.white,
    fontWeight: "700",
  },
  profileCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  noticeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  noticeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeMeta: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  noticeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 12,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeItemTitle: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  noticeEmpty: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  mutedLabel: {
    fontSize: 12,
    color: AppTheme.colors.textMuted,
    marginBottom: 6,
  },
  profileName: {
    fontSize: 23,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  profileMeta: {
    marginTop: 4,
    color: AppTheme.colors.textMuted,
    fontSize: 13,
  },
  statusBadge: {
    backgroundColor: AppTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: AppTheme.radius.pill,
  },
  statusBadgeText: {
    color: AppTheme.colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: 18,
    minHeight: 160,
    justifyContent: "space-between",
    marginTop: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  heroLabel: {
    color: AppTheme.colors.primarySoft,
    fontSize: 13,
    fontWeight: "600",
  },
  heroTime: {
    color: "#b2c6db",
    fontSize: 12,
    textAlign: "right",
  },
  heroStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.primaryMuted,
  },
  heroStatusText: {
    color: AppTheme.colors.white,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  heroHelper: {
    marginTop: 12,
    color: "#bdd0e2",
    fontSize: 12,
    lineHeight: 18,
  },
  quickSection: {
    marginTop: 18,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 10,
  },
  quickCard: {
    flexBasis: "48%",
    maxWidth: "48.5%",
    flexGrow: 1,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    minHeight: 132,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  quickIconWrap: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    marginBottom: 12,
  },
  quickTitle: {
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  quickDescription: {
    color: AppTheme.colors.textMuted,
    lineHeight: 17,
    fontSize: 12,
    marginTop: 6,
  },
  detailCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginTop: 18,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: AppTheme.colors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.border,
  },
  detailLabel: {
    color: AppTheme.colors.textMuted,
  },
  detailValue: {
    color: AppTheme.colors.text,
    fontWeight: "700",
    textTransform: "capitalize",
  },
})
