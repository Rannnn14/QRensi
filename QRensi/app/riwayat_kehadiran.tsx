import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from "react-native"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function RiwayatKehadiran() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    getRiwayat()
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      // Subscribe ke tabel absensi untuk user ini
      subscription = supabase
        .channel("public:absensi-history")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            if (payload.new.status && payload.new.status !== "Belum Absen") {
              setData(prev => [payload.new, ...prev])
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            setData(prev =>
              prev.map(item =>
                item.id === payload.new.id
                  ? payload.new.status && payload.new.status !== "Belum Absen"
                    ? payload.new
                    : null
                  : item
              ).filter(Boolean)
            )
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            setData(prev => prev.filter(item => item.id !== payload.old.id))
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [])

  const getRiwayat = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error } = await supabase
      .from("absensi")
      .select("*")
      .eq("user_id", userId)
      .order("tanggal", { ascending: false })

    if (!error && data) {
      const filtered = data.filter(item => item.status && item.status !== "Belum Absen")
      setData(filtered)
    }

    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = () => {
    setRefreshing(true)
    getRiwayat()
  }

  const getStatusColor = (status: string) => {
    if (status === "Hadir") return "#28C76F"
    if (status === "Izin") return "#FF9F43"
    if (status === "Sakit") return "#FF9F43"
    return "#FF5252"
  }

  const formatTanggal = (tanggal: string) => {
    const date = new Date(tanggal)
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Riwayat Kehadiran</Text>
      {loading ? (
        <ActivityIndicator size="large" />
      ) : data.length === 0 ? (
        <Text style={styles.empty}>Belum ada riwayat kehadiran</Text>
      ) : (
        data.map((item, index) => (
          <View key={index} style={styles.card}>
            <View>
              <Text style={styles.tanggal}>{formatTanggal(item.tanggal)}</Text>
              <Text style={styles.waktu}>{item.waktu}</Text>
            </View>
            <View
              style={[
                styles.statusBox,
                { backgroundColor: getStatusColor(item.status) }
              ]}
            >
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  tanggal: {
    fontSize: 15,
    fontWeight: "600"
  },
  waktu: {
    fontSize: 13,
    color: "#888",
    marginTop: 4
  },
  statusBox: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold"
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    color: "#888"
  }
})