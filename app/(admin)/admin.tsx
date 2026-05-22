import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { AppTheme } from "../../constants/theme"
import { SectionHeader } from "../../components/ui/section-header"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { prepareNotifications, sendLocalNotification } from "../../lib/notifications"
import { formatSubmissionDate, formatSubmissionTime, getSubmissionDisplayType } from "../../lib/pengajuan"

const adminActions = [
  {
    title: "Daftar Akun",
    description: "Cek akun aktif dan tambah siswa",
    icon: "people-outline" as const,
    action: () => router.push("/daftar_akun"),
  },
  {
    title: "Daftar Hadir",
    description: "Pantau absensi harian",
    icon: "clipboard-outline" as const,
    action: () => router.push("/daftar_hadir" as any),
  },
]

type PendingSubmission = {
  id: string
  nama: string
  kelas: string
  jenis: string
  created_at: string
}

export default function Admin() {
  const [counts, setCounts] = useState({
    users: 0,
    pengajuan: 0,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNotificationIdRef = useRef<string | null>(null)

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const fetchCounts = useCallback(async () => {
    const [usersResult, submissionResult, pendingListResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin
        .from("pengajuan")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("pengajuan")
        .select("id, nama, kelas, jenis, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    setCounts({
      users: usersResult.count || 0,
      pengajuan: submissionResult.count || 0,
    })
    setPendingSubmissions((pendingListResult.data || []) as PendingSubmission[])
  }, [])

  const scheduleCountsRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null
      fetchCounts().catch((error) => {
        console.log("Gagal memuat dashboard admin:", error)
      })
    }, 250)
  }, [fetchCounts])

  useEffect(() => {
    prepareNotifications().catch((error) => {
      console.log("Notifikasi admin tidak siap:", error)
    })
    fetchCounts().catch((error) => {
      console.log("Gagal memuat dashboard admin:", error)
    })

    const userSub = supabase
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        scheduleCountsRefresh()
      })
      .subscribe()

    const submissionSub = supabase
        .channel("public:pengajuan")
        .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan" }, (payload) => {
        const payloadId = typeof payload.new === "object" && payload.new ? String((payload.new as { id?: string }).id || "") : ""

        if (payload.eventType === "INSERT" && payloadId && lastNotificationIdRef.current !== payloadId) {
          lastNotificationIdRef.current = payloadId
          sendLocalNotification("Pengajuan baru", "Ada pengajuan baru yang masuk ke panel admin.")
            .catch((error) => {
              console.log("Gagal mengirim notifikasi admin:", error)
            })
        }

        scheduleCountsRefresh()
      })
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      supabase.removeChannel(userSub)
      supabase.removeChannel(submissionSub)
    }
  }, [fetchCounts, scheduleCountsRefresh])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchCounts()
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
        <View style={styles.header}>
          <View style={styles.brandPanel}>
            <View style={styles.brandAccent} />
            <View style={styles.brandTopRow}>
              <View style={styles.brandIdentity}>
                <View style={styles.schoolLogoWrap}>
                  <Image source={require("../../assets/images/Fatahillah.png")} style={styles.schoolLogo} resizeMode="contain" />
                </View>
                <View style={styles.schoolCopy}>
                  <Text style={styles.schoolEyebrow}>Panel Administrasi</Text>
                  <Text style={styles.schoolTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>SMPIT FATAHILLAH</Text>
                  <Text style={styles.schoolCaption}>Pusat kontrol absensi, akun siswa, dan pengajuan sekolah.</Text>
                </View>
              </View>

              <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Dashboard Utama</Text>
          </View>
          <Text style={styles.heroTitle}>
            Panel admin yang ringkas untuk mengelola siswa dan pengajuan dengan lebih rapi.
          </Text>
          <Text style={styles.heroCaption}>
            Fokuskan pekerjaan harian pada akun siswa, pengajuan, dan akses pemindai tanpa tampilan yang ramai.
          </Text>
        </View>

        <TouchableOpacity style={styles.noticeCard} onPress={() => router.push("/pengajuan" as any)}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Daftar Pengajuan</Text>
            <Text style={styles.noticeMeta}>{counts.pengajuan} menunggu</Text>
          </View>
          {pendingSubmissions.length === 0 ? (
            <Text style={styles.noticeEmpty}>Belum ada pengajuan yang menunggu.</Text>
          ) : (
            pendingSubmissions.map((item) => (
              <View key={item.id} style={styles.noticeItem}>
                <View style={styles.noticeBadge}>
                  <Ionicons name="document-text-outline" size={16} color="#16324f" />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeItemTitle}>{item.nama}</Text>
                  <Text style={styles.noticeText}>
                    {getSubmissionDisplayType(item.jenis)} - Kelas {item.kelas}
                  </Text>
                  <Text style={styles.noticeText}>
                    {formatSubmissionDate(item.created_at)} - {formatSubmissionTime(item.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label="Jumlah Siswa" value={counts.users} icon="people-outline" />
          <StatCard label="Jumlah Pengajuan" value={counts.pengajuan} icon="document-text-outline" />
        </View>

        <SectionHeader title="Menu cepat" hint="Akses utama admin" />

        <View style={styles.menuGrid}>
          {adminActions.map((item) => (
            <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.action}>
              <View style={styles.menuAccentShape} />
              <View style={styles.menuTopRow}>
                <View style={styles.iconBox}>
                  <Ionicons name={item.icon} size={19} color={AppTheme.colors.primary} />
                </View>
                <View style={styles.menuArrowWrap}>
                  <Ionicons name="chevron-forward" size={15} color={AppTheme.colors.primary} />
                </View>
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.scanCard} onPress={() => router.push("/scanner" as any)}>
          <View style={styles.scanCopy}>
            <Text style={styles.scanEyebrow}>Aksi cepat</Text>
            <Text style={styles.scanTitle}>Buka pemindai QR</Text>
            <Text style={styles.scanText}>Catat kehadiran siswa langsung dari panel admin.</Text>
          </View>
          <View style={styles.scanIcon}>
            <Ionicons name="scan-outline" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <AdminBottomNav activeKey="admin" />
    </SafeAreaView>
  )
}

const StatCard = ({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: keyof typeof Ionicons.glyphMap
}) => (
  <View style={styles.statCard}>
    <View style={styles.statCardTop}>
      <View style={styles.statIcon}>
        <Ionicons
          name={icon}
          size={18}
          color="#22405f"
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
)

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
  header: {
    marginBottom: 14,
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
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  schoolTitle: {
    color: AppTheme.colors.white,
    fontSize: 18,
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
  logoutButton: {
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
  heroCard: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#D4E2F0",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    color: AppTheme.colors.white,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 29,
  },
  heroCaption: {
    marginTop: 10,
    color: "#BDD0E2",
    fontSize: 13,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    padding: 16,
    marginBottom: 16,
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
  noticeBadge: {
    width: 38,
    height: 38,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeTitle: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  noticeCopy: {
    flex: 1,
  },
  noticeItemTitle: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  noticeText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeEmpty: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    minHeight: 92,
    justifyContent: "space-between",
    ...AppTheme.shadow.sm,
  },
  statCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  statValue: {
    color: AppTheme.colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    columnGap: 10,
  },
  menuItem: {
    width: "48.5%",
    borderRadius: AppTheme.radius.lg,
    padding: 14,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    minHeight: 154,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    gap: 12,
    ...AppTheme.shadow.sm,
  },
  menuAccentShape: {
    position: "absolute",
    right: -26,
    top: -24,
    width: 92,
    height: 76,
    borderRadius: 22,
    backgroundColor: AppTheme.colors.accentSoft,
    transform: [{ rotate: "-18deg" }],
  },
  menuTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  menuArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  menuCopy: {
    zIndex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: AppTheme.colors.text,
    lineHeight: 21,
  },
  menuSubtitle: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    fontWeight: "600",
  },
  scanCard: {
    marginTop: 16,
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
  },
  scanCopy: {
    flex: 1,
  },
  scanEyebrow: {
    color: "#C8DAEE",
    fontSize: 12,
    marginBottom: 6,
  },
  scanTitle: {
    color: AppTheme.colors.white,
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 4,
  },
  scanText: {
    color: "#BDD0E2",
    fontSize: 12,
    lineHeight: 18,
  },
  scanIcon: {
    width: 56,
    height: 56,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
})
