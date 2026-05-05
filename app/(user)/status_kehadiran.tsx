import { View, Text, StyleSheet, RefreshControl } from "react-native"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { Ionicons } from "@expo/vector-icons"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue } from "../../lib/date"
import { getDefaultAttendanceStatus } from "../../lib/pengajuan"
import { AppTheme } from "../../constants/theme"
import { InfoCard } from "../../components/ui/info-card"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"

export default function StatusKehadiran() {
  const [attendance, setAttendance] = useState({ status: "", waktu: "--:--" })
  const [loading, setLoading] = useState(true)
  const [backgroundSyncing, setBackgroundSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedOnceRef = useRef(false)
  const handleBack = useFeatureBack({ fallbackRoute: "/user" })

  const refreshFallbackStatus = () => {
    setAttendance((prev) =>
      prev.status === "Belum Absen" || prev.status === "Tidak Hadir"
        ? { ...prev, status: getDefaultAttendanceStatus() }
        : prev
    )
  }

  useEffect(() => {
    getStatus(true)

    // Setup realtime subscription
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      const today = getLocalDateValue()

      subscription = supabase
        .channel(`public:absensi:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const nextRow = payload.new as
              | { status?: string; tanggal?: string; waktu?: string | null; created_at?: string }
              | undefined
            if (nextRow?.tanggal === today) {
              setAttendance({
                status: nextRow.status || getDefaultAttendanceStatus(),
                waktu: nextRow.waktu
                  ? String(nextRow.waktu).slice(0, 5)
                  : nextRow.created_at
                    ? new Date(nextRow.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--",
              })
            }
          }
        )
        .subscribe()
    }

    setupRealtime()
    const cutoffWatcher = setInterval(refreshFallbackStatus, 30000)

    return () => {
      clearInterval(cutoffWatcher)
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [])

  const getStatus = async (showLoader = false) => {
    if (showLoader || !hasLoadedOnceRef.current) {
      setLoading(true)
    } else {
      setBackgroundSyncing(true)
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setAttendance({ status: "User tidak ditemukan", waktu: "--:--" })
      setLoading(false)
      setBackgroundSyncing(false)
      setRefreshing(false)
      return
    }

    const today = getLocalDateValue()

    const { data, error } = await supabaseAdmin
      .from("absensi")
      .select("status, waktu, created_at")
      .eq("user_id", userId)
      .eq("tanggal", today)
      .maybeSingle()

    if (error || !data) {
      setAttendance({ status: getDefaultAttendanceStatus(), waktu: "--:--" })
    } else {
      setAttendance({
        status: data.status || getDefaultAttendanceStatus(),
        waktu: data.waktu
          ? String(data.waktu).slice(0, 5)
          : data.created_at
            ? new Date(data.created_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--",
      })
    }

    hasLoadedOnceRef.current = true
    setLoading(false)
    setBackgroundSyncing(false)
    setRefreshing(false)
  }

  const onRefresh = () => {
    setRefreshing(true)
    getStatus()
  }

  const normalizedStatus = attendance.status.toLowerCase()
  const statusTheme =
    normalizedStatus === "hadir"
      ? { bg: "#DFF6EF", text: "#17906A", note: "Kehadiranmu sudah tercatat hari ini." }
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? { bg: "#FFF0D9", text: "#C67A12", note: "Status ketidakhadiran sudah diperbarui." }
        : normalizedStatus === "tidak hadir"
          ? { bg: AppTheme.colors.dangerSoft, text: AppTheme.colors.danger, note: "Batas absensi sudah lewat dan belum ada kehadiran atau izin yang disetujui." }
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
            <View style={[styles.syncChip, backgroundSyncing && styles.syncChipActive]}>
              <View style={[styles.syncDot, backgroundSyncing && styles.syncDotActive]} />
              <Text style={styles.syncChipText}>
                {backgroundSyncing ? "Menyinkronkan" : "Realtime"}
              </Text>
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

          <>
            <View style={[styles.statusPill, { backgroundColor: statusTheme.bg }]}>
              <Text style={[styles.status, { color: statusTheme.text }]}>
                {attendance.status || "Belum Absen"}
              </Text>
            </View>
            <Text style={styles.note}>
              {loading
                ? "Status sedang diperbarui."
                : backgroundSyncing
                  ? "Data sedang disinkronkan di latar belakang."
                  : statusTheme.note}
            </Text>
          </>

          <View style={styles.detailCard}>
            <Row label="Jam check-in" value={attendance.waktu === "--:--" ? "Belum tercatat" : attendance.waktu} />
            <Row
              label="Update status"
              value={
                normalizedStatus === "hadir"
                  ? "Scan berhasil"
                  : normalizedStatus === "izin" || normalizedStatus === "sakit"
                    ? "Disetujui admin"
                    : normalizedStatus === "tidak hadir"
                      ? "Lewat batas waktu"
                      : "Menunggu check-in"
              }
            />
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
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  syncChipActive: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderColor: AppTheme.colors.primarySoft,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.success,
  },
  syncDotActive: {
    backgroundColor: AppTheme.colors.primary,
  },
  syncChipText: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
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
