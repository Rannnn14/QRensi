import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from "react-native"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function StatusKehadiran() {
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    getStatus()

    // Setup realtime subscription
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      const today = new Date().toISOString().split("T")[0]

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

    const today = new Date().toISOString().split("T")[0]

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Status Kehadiran Hari Ini</Text>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator size="large" />
        ) : (
          <Text
            style={[
              styles.status,
              status === "Hadir" && { color: "#28C76F" },
              status === "Izin" && { color: "#FF9F43" },
              status === "Sakit" && { color: "#FF9F43" },
              status === "Belum Absen" && { color: "#FF5252" },
            ]}
          >
            {status}
          </Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FB",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    elevation: 3,
  },
  status: {
    fontSize: 20,
    fontWeight: "bold",
  },
})
