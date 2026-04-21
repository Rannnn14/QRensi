import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity } from "react-native"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue } from "../../lib/date"

export default function StatusKehadiran() {
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const handleBack = useFeatureBack({ fallbackRoute: "/user" })

  useEffect(() => {
    getStatus()

    // Setup realtime subscription
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      const today = getLocalDateValue()

      subscription = supabase
        .channel("public:absensi")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId},tanggal=eq.${today}`,
          },
          (payload) => {
            if (payload.new) {
              setStatus(payload.new.status)
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      // Unsubscribe realtime saat komponen di-unmount
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [])

  const getStatus = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setStatus("User tidak ditemukan")
      setLoading(false)
      setRefreshing(false)
      return
    }

    const today = getLocalDateValue()

    const { data, error } = await supabase
      .from("absensi")
      .select("*")
      .eq("user_id", userId)
      .eq("tanggal", today)
      .single()

    if (error || !data) {
      setStatus("Belum Absen")
    } else {
      setStatus(data.status)
    }

    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = () => {
    setRefreshing(true)
    getStatus()
  }

  const normalizedStatus = status.toLowerCase()
  const statusTheme =
    normalizedStatus === "hadir"
      ? { bg: "#DFF6EF", text: "#17906A", note: "Kehadiranmu sudah tercatat hari ini." }
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? { bg: "#FFF0D9", text: "#C67A12", note: "Status ketidakhadiran sudah diperbarui." }
        : { bg: "#F1E6FF", text: "#7B4DFF", note: "Silakan lakukan scan QR untuk mencatat kehadiran." }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Kehadiran Hari Ini</Text>
            <Text style={styles.title}>Status Kehadiran</Text>
          </View>
          <View style={styles.dotMenu}>
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Status presensi harian</Text>
          <Text style={styles.infoText}>Halaman ini menampilkan hasil kehadiran terbaru yang tersimpan untuk hari ini.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#6D3BFF" style={{ marginVertical: 24 }} />
          ) : (
            <>
              <View style={[styles.statusPill, { backgroundColor: statusTheme.bg }]}>
                <Text style={[styles.status, { color: statusTheme.text }]}>{status}</Text>
              </View>
              <Text style={styles.note}>{statusTheme.note}</Text>
            </>
          )}

          <View style={styles.detailCard}>
            <Row label="Kelas" value="Siswa Aktif" />
            <Row label="Metode" value="Scan QR" />
            <Row label="Sinkronisasi" value="Realtime" />
          </View>
        </View>
        </View>
      </ScrollView>
      <UserBottomNav activeKey="status_kehadiran" />
    </SafeAreaView>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
)

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  shell: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#dbe7f4",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    color: "#6d7e90",
    fontSize: 12,
    marginBottom: 4,
  },
  dotMenu: {
    flexDirection: "row",
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11263c",
  },
  infoCard: {
    backgroundColor: "#16324f",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  infoText: {
    marginTop: 6,
    color: "#c7d8e9",
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  dateLabel: {
    textAlign: "center",
    color: "#6d7e90",
    marginBottom: 14,
  },
  statusPill: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  status: {
    fontSize: 22,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  note: {
    marginTop: 14,
    textAlign: "center",
    color: "#6d7e90",
    lineHeight: 20,
  },
  detailCard: {
    marginTop: 22,
    backgroundColor: "#eff4f9",
    borderRadius: 18,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#d7e1eb",
  },
  rowLabel: {
    color: "#6d7e90",
  },
  rowValue: {
    color: "#11263c",
    fontWeight: "700",
  },
})
