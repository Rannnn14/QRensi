import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
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
    attendance: 0,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([])
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNotificationIdRef = useRef<string | null>(null)

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const fetchCounts = async () => {
    const [usersResult, submissionResult, attendanceResult, pendingListResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabaseAdmin
        .from("pengajuan")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("absensi").select("*", { count: "exact", head: true }),
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
      attendance: attendanceResult.count || 0,
    })
    setPendingSubmissions((pendingListResult.data || []) as PendingSubmission[])
  }

  const scheduleCountsRefresh = () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null
      fetchCounts().catch((error) => {
        console.log("Gagal memuat dashboard admin:", error)
      })
    }, 250)
  }

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

    const attendanceSub = supabase
      .channel("public:absensi")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => {
        scheduleCountsRefresh()
      })
      .subscribe()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      supabase.removeChannel(userSub)
      supabase.removeChannel(submissionSub)
      supabase.removeChannel(attendanceSub)
    }
  }, [])

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
          <View style={styles.headerCopy}>
            <Text style={styles.brand}>QRensi</Text>
            <Text style={styles.subtitle}>Admin control center</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onRefresh} disabled={refreshing}>
              <Ionicons
                name={refreshing ? "hourglass-outline" : "refresh-outline"}
                size={18}
                color="#22405f"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Dasbor utama</Text>
          </View>
          <Text style={styles.heroTitle}>
            Kelola akun, absensi, dan pengajuan dengan tampilan penuh yang nyaman di layar HP.
          </Text>
          <Text style={styles.heroCaption}>
            Semua data tetap realtime. Menu cepat di bawah memudahkan akses ke seluruh fitur admin.
          </Text>
        </View>

        <TouchableOpacity style={styles.noticeCard} onPress={() => router.push("/pengajuan" as any)}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Daftar Pengajuan</Text>
            <Text style={styles.noticeMeta}>{counts.pengajuan} pending</Text>
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
                    {getSubmissionDisplayType(item.jenis)} • Kelas {item.kelas}
                  </Text>
                  <Text style={styles.noticeText}>
                    {formatSubmissionDate(item.created_at)} • {formatSubmissionTime(item.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label="Siswa" value={counts.users} icon="people-outline" />
          <StatCard label="Pengajuan" value={counts.pengajuan} icon="document-text-outline" />
          <StatCard label="Absensi" value={counts.attendance} icon="clipboard-outline" />
        </View>

        <SectionHeader title="Menu cepat" hint="Akses utama admin" />

        <View style={styles.menuGrid}>
          {adminActions.map((item) => (
            <TouchableOpacity key={item.title} style={styles.menuItem} onPress={item.action}>
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={20} color="#22405f" />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.scanCard} onPress={() => router.push("/scanner" as any)}>
          <View style={styles.scanCopy}>
            <Text style={styles.scanEyebrow}>Aksi cepat</Text>
            <Text style={styles.scanTitle}>Buka scanner QR</Text>
            <Text style={styles.scanText}>Lakukan check-in siswa langsung dari panel admin.</Text>
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
    <View style={styles.statIcon}>
      <Ionicons name={icon} size={18} color="#22405f" />
    </View>
    <Text style={styles.statValue}>{value}</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
  },
  brand: {
    ...AppTheme.typography.display,
  },
  subtitle: {
    color: AppTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logoutText: {
    color: AppTheme.colors.white,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: 20,
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: AppTheme.colors.primaryMuted,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: AppTheme.colors.primarySoft,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    color: AppTheme.colors.white,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 31,
  },
  heroCaption: {
    marginTop: 10,
    color: "#bfd1e4",
    fontSize: 13,
    lineHeight: 18,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
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
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  statValue: {
    color: AppTheme.colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 14,
  },
  statLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  menuItem: {
    width: "48.5%",
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    minHeight: 140,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  menuSubtitle: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  scanCard: {
    marginTop: 16,
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.xl,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  scanCopy: {
    flex: 1,
  },
  scanEyebrow: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  scanTitle: {
    color: AppTheme.colors.text,
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 4,
  },
  scanText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  scanIcon: {
    width: 56,
    height: 56,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
})
