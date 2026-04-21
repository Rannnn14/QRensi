import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue } from "../../lib/date"
import { AppTheme } from "../../constants/theme"
import { InfoCard } from "../../components/ui/info-card"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"

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
        : { bg: AppTheme.colors.primarySoft, text: AppTheme.colors.primary, note: "Silakan lakukan scan QR untuk mencatat kehadiran." }

  return (
    <ScreenShell
      scroll
      footer={<UserBottomNav activeKey="status_kehadiran" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <View style={styles.shell}>
        <PageHeader
          eyebrow="Kehadiran Hari Ini"
          title="Status Kehadiran"
          onBackPress={handleBack}
          rightSlot={
            <View style={styles.dotMenu}>
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
            <Ionicons name="ellipse" size={6} color="#BBA9F5" />
            </View>
          }
        />

        <InfoCard
          title="Status presensi harian"
          description="Halaman ini menampilkan hasil kehadiran terbaru yang tersimpan untuk hari ini."
        />

        <ModalCard style={styles.card}>
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
        </ModalCard>
        </View>
    </ScreenShell>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
)

const styles = StyleSheet.create({
  shell: {
    paddingBottom: 8,
  },
  dotMenu: {
    flexDirection: "row",
    gap: 4,
  },
  card: {
    padding: 22,
  },
  dateLabel: {
    textAlign: "center",
    color: AppTheme.colors.textMuted,
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
    color: AppTheme.colors.textMuted,
    lineHeight: 20,
  },
  detailCard: {
    marginTop: 22,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.md,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.border,
  },
  rowLabel: {
    color: AppTheme.colors.textMuted,
  },
  rowValue: {
    color: AppTheme.colors.text,
    fontWeight: "700",
  },
})
