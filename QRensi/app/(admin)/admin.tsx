import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { supabase } from "../../lib/supabase"
import { prepareNotifications, sendLocalNotification } from "../../lib/notifications"

const adminActions = [
  {
    title: "Tambah User",
    description: "Buat akun siswa baru",
    icon: "person-add-outline" as const,
    action: () => router.push("/tambah_user"),
  },
  {
    title: "Daftar Akun",
    description: "Cek akun aktif per kelas",
    icon: "people-outline" as const,
    action: () => router.push("/daftar_akun"),
  },
  {
    title: "Daftar Hadir",
    description: "Pantau absensi harian",
    icon: "clipboard-outline" as const,
    action: () => router.push("/daftar_hadir" as any),
  },
  {
    title: "Pengajuan",
    description: "Review izin dan sakit",
    icon: "document-text-outline" as const,
    action: () => router.push("/pengajuan" as any),
  },
]

export default function Admin() {
  const [counts, setCounts] = useState({
    users: 0,
    pengajuan: 0,
    attendance: 0,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [adminNotice, setAdminNotice] = useState("Belum ada notifikasi baru.")

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const fetchCounts = async () => {
    const [usersResult, submissionResult, attendanceResult] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "user"),
      supabase.from("pengajuan").select("*", { count: "exact", head: true }),
      supabase.from("absensi").select("*", { count: "exact", head: true }),
    ])

    setCounts({
      users: usersResult.count || 0,
      pengajuan: submissionResult.count || 0,
      attendance: attendanceResult.count || 0,
    })

    const pendingSubmissions = submissionResult.count || 0
    setAdminNotice(
      pendingSubmissions > 0
        ? `${pendingSubmissions} pengajuan sedang menunggu review admin.`
        : "Belum ada pengajuan baru yang perlu dicek."
    )
  }

  useEffect(() => {
    prepareNotifications()
    fetchCounts()

    const userSub = supabase
      .channel("public:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchCounts)
      .subscribe()

    const submissionSub = supabase
      .channel("public:pengajuan")
      .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setAdminNotice("Ada pengajuan baru masuk. Silakan cek halaman pengajuan.")
          sendLocalNotification("Pengajuan baru", "Ada pengajuan baru yang masuk ke panel admin.")
        }

        fetchCounts()
      })
      .subscribe()

    const attendanceSub = supabase
      .channel("public:absensi")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, fetchCounts)
      .subscribe()

    return () => {
      supabase.removeChannel(userSub)
      supabase.removeChannel(submissionSub)
      supabase.removeChannel(attendanceSub)
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchCounts()
    setRefreshing(false)
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
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push("/pengajuan" as any)}
            >
              <Ionicons name="notifications-outline" size={18} color="#22405f" />
              {counts.pengajuan > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{counts.pengajuan > 9 ? "9+" : counts.pengajuan}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
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
          <View style={styles.noticeIconWrap}>
            <Ionicons name="notifications-outline" size={18} color="#16324f" />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Notifikasi admin</Text>
            <Text style={styles.noticeText}>{adminNotice}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label="Siswa" value={counts.users} icon="people-outline" />
          <StatCard label="Pengajuan" value={counts.pengajuan} icon="document-text-outline" />
          <StatCard label="Absensi" value={counts.attendance} icon="clipboard-outline" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Menu cepat</Text>
          <Text style={styles.sectionHint}>Akses utama admin</Text>
        </View>

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
    backgroundColor: "#f4f7fb",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    color: "#11263c",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6d7e90",
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
    borderRadius: 14,
    backgroundColor: "#dbe7f4",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16324f",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logoutText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#16324f",
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#284b70",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: "#d7e6f5",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    color: "#ffffff",
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
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2eaf2",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noticeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eaf2fb",
    justifyContent: "center",
    alignItems: "center",
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: "#11263c",
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    marginTop: 4,
    color: "#6d7e90",
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
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e4eef8",
  },
  statValue: {
    color: "#11263c",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 14,
  },
  statLabel: {
    color: "#6d7e90",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    color: "#11263c",
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHint: {
    color: "#6d7e90",
    fontSize: 12,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  menuItem: {
    width: "48.5%",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2eaf2",
    minHeight: 140,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e4eef8",
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#11263c",
  },
  menuSubtitle: {
    color: "#6b7a89",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  scanCard: {
    marginTop: 16,
    backgroundColor: "#dbe7f4",
    borderRadius: 24,
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
    color: "#56708a",
    fontSize: 12,
    marginBottom: 6,
  },
  scanTitle: {
    color: "#11263c",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 4,
  },
  scanText: {
    color: "#5f7388",
    fontSize: 12,
    lineHeight: 18,
  },
  scanIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#16324f",
    justifyContent: "center",
    alignItems: "center",
  },
})
