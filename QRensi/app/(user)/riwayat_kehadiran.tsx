import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import { SafeAreaView } from "react-native-safe-area-context"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue, getLocalMonthValue, shiftMonthValue } from "../../lib/date"
import { saveCsvFile } from "../../lib/device-files"
import { getYearOptions, MONTH_OPTIONS } from "../../lib/calendar"

type AttendanceItem = {
  id: string
  tanggal: string
  waktu?: string | null
  status?: string | null
}

export default function RiwayatKehadiran() {
  const [data, setData] = useState<AttendanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getLocalDateValue())
  const [calendarMonth, setCalendarMonth] = useState(getLocalMonthValue())
  const [downloading, setDownloading] = useState(false)
  const handleBack = useFeatureBack({
    fallbackRoute: "/user",
    beforeBack: () => {
      if (calendarVisible) {
        setCalendarVisible(false)
        return true
      }

      return false
    },
  })

  const getRiwayat = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: attendanceData, error } = await supabase
      .from("absensi")
      .select("*")
      .eq("user_id", userId)
      .order("tanggal", { ascending: false })

    if (!error && attendanceData) {
      const filtered = attendanceData.filter((item) => item.status && item.status !== "Belum Absen")
      setData(filtered)

      if (filtered.length) {
        setSelectedDate((prev) => prev || filtered[0].tanggal)
      }
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    getRiwayat()
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return

      subscription = supabase
        .channel("public:absensi-history")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "absensi",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            getRiwayat()
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [getRiwayat])

  useEffect(() => {
    setCalendarMonth(selectedDate.slice(0, 7))
  }, [selectedDate])

  const onRefresh = () => {
    setRefreshing(true)
    getRiwayat()
  }

  const formatMonthLabel = (monthValue: string) =>
    new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    })

  const formatTanggal = (tanggal: string) =>
    new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const changeMonth = (offset: number) => {
    setCalendarMonth(shiftMonthValue(calendarMonth, offset))
  }

  const handleMonthPickerChange = (monthNumber: number) => {
    const [year] = calendarMonth.split("-")
    setCalendarMonth(`${year}-${String(monthNumber).padStart(2, "0")}`)
  }

  const handleYearPickerChange = (year: number) => {
    const [, month] = calendarMonth.split("-")
    setCalendarMonth(`${year}-${month}`)
  }

  const getCalendarDays = () => {
    const [year, month] = calendarMonth.split("-").map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const startDay = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(year, month, 0).getDate()
    const days: string[] = []

    for (let index = 0; index < startDay; index += 1) {
      days.push("")
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(`${calendarMonth}-${String(day).padStart(2, "0")}`)
    }

    while (days.length % 7 !== 0) {
      days.push("")
    }

    return days
  }

  const getStatusColor = (status: string | null | undefined) => {
    const normalized = String(status || "").toLowerCase()
    if (normalized === "hadir") return "#22C55E"
    if (normalized === "izin") return "#F59E0B"
    if (normalized === "sakit") return "#EF4444"
    return "#94A3B8"
  }

  const getStatusLabel = (status: string | null | undefined) => {
    if (!status) return "Tidak Hadir"
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const getAttendanceByDate = (tanggal: string) => data.find((item) => item.tanggal === tanggal)

  const selectedAttendance = getAttendanceByDate(selectedDate)

  const downloadAttendance = async () => {
    try {
      setDownloading(true)

      const activeMonth = selectedDate.slice(0, 7)
      const [year, month] = activeMonth.split("-").map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      const csvRows = Array.from({ length: daysInMonth }, (_, index) => {
        const tanggal = `${activeMonth}-${String(index + 1).padStart(2, "0")}`
        const item = getAttendanceByDate(tanggal)

        return [
          index + 1,
          tanggal,
          formatTanggal(tanggal),
          getStatusLabel(item?.status),
          item?.waktu || "-",
        ]
      })

      const escapeCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
      const csvContent = [
        ["No", "Tanggal", "Detail Hari", "Status", "Waktu"].map(escapeCsvValue).join(","),
        ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
      ].join("\n")

      const fileName = `riwayat_kehadiran_${activeMonth}.csv`

      const result = await saveCsvFile(fileName, csvContent)
      const successMessage =
        result.mode === "saved"
          ? "Riwayat kehadiran berhasil disimpan ke folder yang dipilih."
          : result.mode === "shared"
            ? "File riwayat sudah siap dibagikan atau disimpan dari menu perangkat."
            : "Riwayat kehadiran berhasil diexport."

      Alert.alert("Berhasil", successMessage)
    } catch (error) {
      console.log(error)
      Alert.alert("Gagal", "Export riwayat kehadiran belum berhasil.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.shell}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>Kalender pribadi</Text>
              <Text style={styles.title}>Riwayat Kehadiran</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Rekap kehadiran per bulan</Text>
            <Text style={styles.infoText}>
              Pilih bulan dari kalender untuk melihat status hadir, izin, sakit, atau tidak hadir.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#6D3BFF" style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Periode aktif</Text>
                <Text style={styles.summaryValue}>{formatMonthLabel(selectedDate.slice(0, 7))}</Text>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => {
                    setCalendarMonth(selectedDate.slice(0, 7))
                    setCalendarVisible(true)
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#16324f" />
                  <Text style={styles.secondaryActionText}>Pilih Bulan</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionCard}>
                <TouchableOpacity
                  style={[styles.downloadAction, downloading && styles.actionDisabled]}
                  onPress={downloadAttendance}
                  disabled={downloading}
                >
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.downloadText}>
                    {downloading ? "Menyiapkan..." : "Export Excel"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Tanggal dipilih</Text>
                <Text style={styles.detailDate}>{formatTanggal(selectedDate)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedAttendance?.status)}22` }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(selectedAttendance?.status) }]}>
                    {getStatusLabel(selectedAttendance?.status)}
                  </Text>
                </View>
                <Text style={styles.detailTime}>
                  {selectedAttendance?.waktu ? `Waktu: ${selectedAttendance.waktu}` : "Belum ada waktu tercatat"}
                </Text>
              </View>

              <View style={styles.calendarPreview}>
                <View style={styles.weekHeader}>
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                    <Text key={day} style={styles.weekLabel}>{day}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {getCalendarDays().map((item, index) => {
                    if (!item) {
                      return <View key={`empty-${index}`} style={styles.calendarCell} />
                    }

                    const selected = selectedDate === item
                    const itemStatus = getAttendanceByDate(item)?.status

                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.calendarCell, selected && styles.calendarCellActive]}
                        onPress={() => setSelectedDate(item)}
                      >
                        <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                          {item.slice(-2).replace(/^0/, "")}
                        </Text>
                        <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} />
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={calendarVisible} onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Pilih bulan</Text>
                <Text style={styles.modalTitle}>{formatMonthLabel(calendarMonth)}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalMonthHeader}>
              <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={18} color="#22405f" />
              </TouchableOpacity>
              <Text style={styles.modalMonthTitle}>{formatMonthLabel(calendarMonth)}</Text>
              <TouchableOpacity style={styles.calendarNav} onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color="#22405f" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerRow}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={Number(calendarMonth.split("-")[1])}
                  onValueChange={(value) => handleMonthPickerChange(Number(value))}
                >
                  {MONTH_OPTIONS.map((item) => (
                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={Number(calendarMonth.split("-")[0])}
                  onValueChange={(value) => handleYearPickerChange(Number(value))}
                >
                  {getYearOptions(Number(calendarMonth.split("-")[0]), 5).map((year) => (
                    <Picker.Item key={year} label={String(year)} value={year} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.weekHeader}>
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                <Text key={day} style={styles.weekLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {getCalendarDays().map((item, index) => {
                if (!item) {
                  return <View key={`modal-empty-${index}`} style={styles.calendarCell} />
                }

                const selected = selectedDate === item
                const itemStatus = getAttendanceByDate(item)?.status

                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.calendarCell, selected && styles.calendarCellActive]}
                    onPress={() => {
                      setSelectedDate(item)
                      setCalendarVisible(false)
                    }}
                  >
                    <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                      {item.slice(-2).replace(/^0/, "")}
                    </Text>
                    <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} />
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        </View>
      </Modal>

      <UserBottomNav activeKey="riwayat_kehadiran" />
    </SafeAreaView>
  )
}

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
    marginLeft: 12,
    flex: 1,
  },
  eyebrow: {
    color: "#6d7e90",
    fontSize: 12,
    marginBottom: 4,
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
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  summaryLabel: {
    color: "#6d7e90",
    marginBottom: 6,
  },
  summaryValue: {
    color: "#11263c",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 14,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbe7f4",
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
  },
  secondaryActionText: {
    color: "#16324f",
    fontWeight: "700",
  },
  actionCard: {
    marginBottom: 14,
  },
  downloadAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16324f",
    borderRadius: 16,
    paddingVertical: 13,
  },
  downloadText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  actionDisabled: {
    opacity: 0.7,
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2eaf2",
    marginBottom: 14,
  },
  detailLabel: {
    color: "#6d7e90",
    fontSize: 12,
    marginBottom: 4,
  },
  detailDate: {
    color: "#11263c",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  detailTime: {
    color: "#6d7e90",
    marginTop: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontWeight: "800",
  },
  calendarPreview: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weekLabel: {
    width: "14.28%",
    textAlign: "center",
    color: "#6d7e90",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginBottom: 8,
  },
  calendarCellActive: {
    backgroundColor: "#16324f",
  },
  calendarCellText: {
    color: "#11263c",
    fontSize: 14,
    fontWeight: "700",
  },
  calendarCellTextActive: {
    color: "#ffffff",
  },
  calendarDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 38, 60, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalEyebrow: {
    color: "#6d7e90",
    fontSize: 12,
    marginBottom: 4,
  },
  modalTitle: {
    color: "#11263c",
    fontSize: 20,
    fontWeight: "800",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#dbe7f4",
    alignItems: "center",
    justifyContent: "center",
  },
  modalMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 14,
  },
  modalMonthTitle: {
    color: "#11263c",
    fontSize: 15,
    fontWeight: "800",
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#dbe7f4",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  pickerWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2eaf2",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
})
