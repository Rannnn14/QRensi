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

type ProfileState = {
  name: string
  kelas: string
}

type AttendanceState = {
  status: string
  waktu: string
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
    description: "Laporkan ketidakhadiran",
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
  const [attendance, setAttendance] = useState<AttendanceState>({ status: "Belum Absen", waktu: "--:--" })
  const [refreshing, setRefreshing] = useState(false)
  const [userNotice, setUserNotice] = useState("Belum ada notifikasi kehadiran baru.")
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false)

  useEffect(() => {
    prepareNotifications()
    let profileChannel: any = null
    let attendanceChannel: any = null

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
      const { data: attendanceData } = await supabase
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .single()

      setAttendance({
        status: attendanceData?.status || "Belum Absen",
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      if (attendanceData?.status) {
        setUserNotice(`Status kehadiran hari ini: ${attendanceData.status}.`)
      }

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
              status: payload.new?.status || "Belum Absen",
              waktu: latestTime,
            })
            setUserNotice(`Kehadiran diperbarui: ${payload.new?.status || "Belum Absen"} pada ${latestTime}.`)
            setHasUnreadNotice(true)
            sendLocalNotification(
              "Update kehadiran",
              `Status kamu sekarang ${payload.new?.status || "Belum Absen"} pada ${latestTime}.`
            )
          }
        )
        .subscribe()
    }

    loadDashboard()

    return () => {
      if (profileChannel) supabase.removeChannel(profileChannel)
      if (attendanceChannel) supabase.removeChannel(attendanceChannel)
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
      const { data: attendanceData } = await supabase
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .single()

      setAttendance({
        status: attendanceData?.status || "Belum Absen",
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      setUserNotice(
        attendanceData?.status
          ? `Status kehadiran hari ini: ${attendanceData.status}.`
          : "Belum ada notifikasi kehadiran baru."
      )
    }
    setRefreshing(false)
  }

  const normalizedStatus = attendance.status.toLowerCase()

  const statusColor =
    normalizedStatus === "hadir"
      ? "#1e8c5d"
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? "#ba7412"
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
          <View>
            <Text style={styles.brand}>QRensi</Text>
            <Text style={styles.subtitle}>Student dashboard</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setHasUnreadNotice(false)
                router.push("/status_kehadiran" as any)
              }}
            >
              <Ionicons name="notifications-outline" size={18} color="#22405f" />
              {hasUnreadNotice ? <View style={styles.notificationDot} /> : null}
            </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.noticeCard}
          onPress={() => {
            setHasUnreadNotice(false)
            router.push("/status_kehadiran" as any)
          }}
        >
          <View style={styles.noticeIconWrap}>
            <Ionicons name="notifications-outline" size={18} color="#16324f" />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Notifikasi siswa</Text>
            <Text style={styles.noticeText}>{userNotice}</Text>
          </View>
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
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  notificationDot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.danger,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noticeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: 4,
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
    gap: 10,
  },
  quickCard: {
    width: "48.5%",
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
