import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useEffect, useRef, useState } from "react"
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
  cleanupExpiredSubmissions,
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

const emptyProfile: ProfileState = { name: "", kelas: "-" }
const emptyAttendance = (): AttendanceState => ({
  status: getDefaultAttendanceStatus(),
  waktu: "--:--",
})

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
  const [profile, setProfile] = useState<ProfileState>(emptyProfile)
  const [attendance, setAttendance] = useState<AttendanceState>(emptyAttendance())
  const [refreshing, setRefreshing] = useState(false)
  const [todaySubmissions, setTodaySubmissions] = useState<SubmissionState[]>([])
  const activeUserIdRef = useRef<string | null>(null)
  const loadTokenRef = useRef(0)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    prepareNotifications().catch((error) => {
      console.log("Notifikasi tidak siap:", error)
    })
    let profileChannel: any = null
    let attendanceChannel: any = null
    let submissionChannel: any = null

    const resetDashboardState = () => {
      activeUserIdRef.current = null
      setProfile(emptyProfile)
      setAttendance(emptyAttendance())
      setTodaySubmissions([])
    }

    const removeRealtimeChannels = () => {
      if (profileChannel) {
        supabase.removeChannel(profileChannel)
        profileChannel = null
      }

      if (attendanceChannel) {
        supabase.removeChannel(attendanceChannel)
        attendanceChannel = null
      }

      if (submissionChannel) {
        supabase.removeChannel(submissionChannel)
        submissionChannel = null
      }
    }

    const loadTodaySubmissions = async (userId: string) => {
      try {
        await cleanupExpiredSubmissions()
        const { data: submissionData, error } = await supabaseAdmin
          .from("pengajuan")
          .select("id, jenis, status, created_at")
          .eq("user_id", userId)
          .neq("jenis", PASSWORD_REQUEST_TYPE)
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
        setTodaySubmissions(filtered as SubmissionState[])
      } catch (error) {
        console.log("Gagal memuat pengajuan hari ini:", error)
        setTodaySubmissions([])
      }
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

    const loadDashboard = async (
      nextUserId?: string | null,
      showLoader = true,
      forceVisibleReset = false
    ) => {
      const currentLoadToken = loadTokenRef.current + 1
      loadTokenRef.current = currentLoadToken
      const isSwitchingUser = Boolean(
        nextUserId && activeUserIdRef.current && nextUserId !== activeUserIdRef.current
      )
      const shouldResetVisibleState = forceVisibleReset || isSwitchingUser

      removeRealtimeChannels()
      if (shouldResetVisibleState) {
        resetDashboardState()
      }

      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user || (nextUserId && user.id !== nextUserId)) {
          return
        }

        activeUserIdRef.current = user.id

        const fallbackName = user.email ? user.email.split("@")[0] : "Siswa"
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("nama, kelas")
          .eq("id", user.id)
          .single()

        if (profileError) {
          throw profileError
        }

        if (loadTokenRef.current !== currentLoadToken || activeUserIdRef.current !== user.id) {
          return
        }

        setProfile({
          name: profileData?.nama || fallbackName,
          kelas: profileData?.kelas || "-",
        })

        const today = getLocalDateValue()
        const { data: attendanceData, error: attendanceError } = await supabaseAdmin
          .from("absensi")
          .select("status, created_at")
          .eq("user_id", user.id)
          .eq("tanggal", today)
          .maybeSingle()

        if (attendanceError) {
          throw attendanceError
        }

        if (loadTokenRef.current !== currentLoadToken || activeUserIdRef.current !== user.id) {
          return
        }

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

        if (loadTokenRef.current !== currentLoadToken || activeUserIdRef.current !== user.id) {
          return
        }

        hasLoadedOnceRef.current = true

        profileChannel = supabase
          .channel("realtime-user-" + user.id)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
            (payload: { new?: { nama?: string; kelas?: string } }) => {
              if (activeUserIdRef.current !== user.id) return
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
              if (activeUserIdRef.current !== user.id) return
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
              ).catch((error) => {
                console.log("Gagal mengirim notifikasi lokal:", error)
              })
            }
          )
          .subscribe()

        submissionChannel = supabase
          .channel("realtime-submission-" + user.id)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pengajuan", filter: `user_id=eq.${user.id}` },
            () => {
              if (activeUserIdRef.current !== user.id) return
              loadTodaySubmissions(user.id).catch(() => undefined)
            }
          )
          .subscribe()
      } catch (error) {
        console.log("Gagal memuat dashboard user:", error)
        if (!hasLoadedOnceRef.current || shouldResetVisibleState) {
          resetDashboardState()
        }
      }
    }

    loadDashboard()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUserId = session?.user?.id || null

      if (!sessionUserId) {
        loadTokenRef.current += 1
        hasLoadedOnceRef.current = false
        removeRealtimeChannels()
        resetDashboardState()
        return
      }

      if (sessionUserId !== activeUserIdRef.current) {
        loadDashboard(sessionUserId, true, true)
      }
    })
    const cutoffWatcher = setInterval(applyFallbackAttendance, 30000)

    return () => {
      clearInterval(cutoffWatcher)
      authListener.subscription.unsubscribe()
      removeRealtimeChannels()
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (user) {
        activeUserIdRef.current = user.id
        const today = getLocalDateValue()
        const { data: attendanceData, error: attendanceError } = await supabaseAdmin
          .from("absensi")
          .select("status, created_at")
          .eq("user_id", user.id)
          .eq("tanggal", today)
          .maybeSingle()

        if (attendanceError) {
          throw attendanceError
        }

        setAttendance({
          status: attendanceData?.status || getDefaultAttendanceStatus(),
          waktu: attendanceData?.created_at
            ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--",
        })

        await cleanupExpiredSubmissions()
        const { data: submissionData, error: submissionError } = await supabaseAdmin
          .from("pengajuan")
          .select("id, jenis, status, created_at")
          .eq("user_id", user.id)
          .neq("jenis", PASSWORD_REQUEST_TYPE)
          .order("created_at", { ascending: false })

        if (submissionError) {
          throw submissionError
        }

        const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
        setTodaySubmissions(filtered as SubmissionState[])
      }
    } catch (error) {
      console.log("Gagal refresh dashboard user:", error)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.brandPanel}>
            <View style={styles.brandAccent} />
            <View style={styles.brandTopRow}>
              <View style={styles.brandIdentity}>
                <View style={styles.schoolLogoWrap}>
                  <Image source={require("../../assets/images/Fatahillah.png")} style={styles.schoolLogo} resizeMode="contain" />
                </View>
                <View style={styles.schoolCopy}>
                  <Text style={styles.schoolEyebrow}>Beranda Siswa</Text>
                  <Text style={styles.schoolTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>SMPIT FATAHILLAH</Text>
                  <Text style={styles.schoolCaption}>Pantau kehadiran, pengajuan, dan akses QR siswa dalam satu tempat.</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  await supabase.auth.signOut({ scope: "local" })
                  router.replace("/login")
                }}
                style={styles.logoutBtn}
              >
                <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAccentRail} />
          <View style={styles.profileCornerShape} />
          <View style={styles.profileIconWrap}>
            <Ionicons name="person" size={34} color={AppTheme.colors.white} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.mutedLabel}>Profil Siswa</Text>
            <Text style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {profile.name || "-"}
            </Text>
            <View style={styles.profileInfoRow}>
              <View style={styles.profileClassPill}>
                <Ionicons name="school-outline" size={14} color={AppTheme.colors.primary} />
                <Text style={styles.profileClass} numberOfLines={1}>
                  {profile.kelas || "-"}
                </Text>
              </View>
              <View style={styles.profileStatusPill}>
                <View style={styles.profileStatusDot} />
                <Text style={styles.profileStatusText}>Aktif</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.noticeCard}
          onPress={() => {
            if (profile.kelas?.trim().toLowerCase() === "alumni") {
              Alert.alert("Akses Ditolak", "Alumni tidak memiliki akses untuk pengajuan izin.")
              return
            }
            router.push("/ajuan" as any)
          }}
        >
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Riwayat Pengajuan Hari Ini</Text>
            <Text style={styles.noticeMeta}>{`${todaySubmissions.length} data`}</Text>
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
          onPress={() => {
            if (profile.kelas?.trim().toLowerCase() === "alumni") {
              Alert.alert("Akses Ditolak", "Alumni tidak memiliki akses untuk fitur absensi.")
              return
            }
            router.push("/status_kehadiran" as any)
          }}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Kehadiran hari ini</Text>
            <Text style={styles.heroTime}>
              {attendance.waktu === "--:--" ? "Belum absen" : `Absen ${attendance.waktu}`}
            </Text>
          </View>
          <View style={styles.heroStatusPill}>
            <Text style={styles.heroStatusText}>{attendance.status}</Text>
          </View>
          <Text style={styles.heroHelper}>
            Ringkasan status kehadiran tampil otomatis setiap kali data berubah.
          </Text>
        </TouchableOpacity>

        <View style={styles.quickSection}>
          <SectionHeader title="Akses cepat" hint="Jalur utama untuk aktivitas siswa" />
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={styles.quickCard}
                onPress={() => {
                  if (profile.kelas?.trim().toLowerCase() === "alumni") {
                    if (item.title === "Ajukan Izin") {
                      Alert.alert("Akses Ditolak", "Alumni tidak memiliki akses untuk pengajuan izin.")
                    } else {
                      Alert.alert("Akses Ditolak", "Alumni tidak memiliki akses untuk fitur absensi.")
                    }
                    return
                  }
                  item.action()
                }}
              >
                <View style={styles.quickAccentShape} />
                <View style={styles.quickTopRow}>
                  <View style={styles.quickIconWrap}>
                    <Ionicons name={item.icon} size={19} color={AppTheme.colors.primary} />
                  </View>
                  <View style={styles.quickArrowWrap}>
                    <Ionicons name="chevron-forward" size={15} color={AppTheme.colors.primary} />
                  </View>
                </View>
                <View style={styles.quickCopy}>
                  <Text style={styles.quickTitle}>{item.title}</Text>
                  <Text style={styles.quickDescription}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
    marginBottom: 12,
  },
  brandPanel: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: AppTheme.colors.primary,
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
    ...AppTheme.shadow.sm,
    position: "relative",
    overflow: "hidden",
  },
  brandAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: AppTheme.colors.accent,
  },
  brandTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  schoolLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 8,
  },
  schoolLogo: {
    width: 50,
    height: 50,
  },
  schoolCopy: {
    flex: 1,
    gap: 2,
  },
  schoolEyebrow: {
    color: "#C8DAEE",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  schoolTitle: {
    fontSize: 18,
    color: AppTheme.colors.white,
    fontWeight: "900",
    lineHeight: 24,
    paddingRight: 4,
  },
  schoolCaption: {
    color: "#C0D2E5",
    fontSize: 11,
    lineHeight: 16,
    maxWidth: 232,
  },
  logoutBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignSelf: "center",
  },
  profileCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    gap: 16,
    minHeight: 112,
    overflow: "hidden",
    position: "relative",
    ...AppTheme.shadow.sm,
  },
  profileAccentRail: {
    position: "absolute",
    left: 0,
    top: 16,
    bottom: 16,
    width: 5,
    borderTopRightRadius: AppTheme.radius.pill,
    borderBottomRightRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.accent,
  },
  profileCornerShape: {
    position: "absolute",
    right: -34,
    top: -28,
    width: 128,
    height: 74,
    borderRadius: 18,
    backgroundColor: AppTheme.colors.accentSoft,
    transform: [{ rotate: "-18deg" }],
  },
  profileIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AppTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: AppTheme.colors.primarySoft,
    zIndex: 1,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
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
    fontSize: 10,
    color: AppTheme.colors.primary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  profileName: {
    fontSize: 25,
    fontWeight: "900",
    color: AppTheme.colors.text,
    lineHeight: 30,
  },
  profileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
  },
  profileClassPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    maxWidth: "62%",
  },
  profileClass: {
    color: AppTheme.colors.primary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  profileStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  profileStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AppTheme.colors.success,
  },
  profileStatusText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
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
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  heroLabel: {
    color: "#D4E2F0",
    fontSize: 13,
    fontWeight: "700",
  },
  heroTime: {
    color: "#BDD0E2",
    fontSize: 12,
    textAlign: "right",
  },
  heroStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroStatusText: {
    color: AppTheme.colors.white,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  heroHelper: {
    marginTop: 12,
    color: "#BDD0E2",
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
    rowGap: 14,
    columnGap: 10,
  },
  quickCard: {
    flexBasis: "48%",
    maxWidth: "48.5%",
    flexGrow: 1,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 14,
    minHeight: 154,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    gap: 12,
    ...AppTheme.shadow.sm,
  },
  quickAccentShape: {
    position: "absolute",
    right: -26,
    top: -24,
    width: 92,
    height: 76,
    borderRadius: 22,
    backgroundColor: AppTheme.colors.accentSoft,
    transform: [{ rotate: "-18deg" }],
  },
  quickTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  quickArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  quickCopy: {
    zIndex: 1,
  },
  quickTitle: {
    color: AppTheme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  quickDescription: {
    color: AppTheme.colors.textMuted,
    lineHeight: 18,
    fontSize: 12,
    marginTop: 7,
    fontWeight: "600",
  },
})
