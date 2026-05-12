import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { useFocusEffect } from "expo-router"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import { UserBottomNav } from "../../components/user-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { getLocalDateValue, getLocalMonthValue, shiftMonthValue } from "../../lib/date"
import { getYearOptions, MONTH_OPTIONS } from "../../lib/calendar"
import { AppTheme } from "../../constants/theme"
import { InfoCard } from "../../components/ui/info-card"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"

type AttendanceItem = {
  id: string
  tanggal: string
  waktu?: string | null
  status?: string | null
}

type AttendanceStatus =
  | "hadir"
  | "izin"
  | "sakit"
  | "tidak hadir"
  | "belum ada data"

export default function RiwayatKehadiran() {
  const [data, setData] = useState<AttendanceItem[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getLocalDateValue())
  const [calendarMonth, setCalendarMonth] = useState(getLocalMonthValue())
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

  const normalizeAttendanceStatus = useCallback((status?: string | null) => {
    const normalized = String(status || "").trim().toLowerCase()

    if (normalized === "hadir" || normalized === "izin" || normalized === "sakit") {
      return normalized
    }

    if (normalized === "tidak hadir" || normalized === "tidakhadir") {
      return "tidak hadir"
    }

    if (normalized === "belum ada data" || normalized === "belumadadata") {
      return "belum ada data"
    }

    return normalized || null
  }, [])

  const resolveAttendanceStatus = useCallback(
    (item?: { status?: string | null; tanggal?: string } | null, tanggal?: string): AttendanceStatus => {
      const normalized = normalizeAttendanceStatus(item?.status)

      if (normalized === "hadir" || normalized === "izin" || normalized === "sakit" || normalized === "tidak hadir") {
        return normalized
      }

      const targetDate = tanggal || item?.tanggal
      if (!targetDate) {
        return "tidak hadir"
      }

      const today = getLocalDateValue()
      if (targetDate > today) {
        return "belum ada data"
      }

      return "tidak hadir"
    },
    [normalizeAttendanceStatus]
  )

  const getRiwayat = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      if (!userId) {
        setData([])
        setAvailableDates([])
        setRefreshing(false)
        return
      }

      const { data: attendanceData, error } = await supabaseAdmin
        .from("absensi")
        .select("id, tanggal, status, waktu, created_at")
        .eq("user_id", userId)
        .order("tanggal", { ascending: false })

      if (error) {
        throw error
      }

      const normalized = (attendanceData || []).map((item) => ({
        id: item.id,
        tanggal: item.tanggal,
        waktu: item.waktu
          ? String(item.waktu).slice(0, 5)
          : item.created_at
          ? new Date(item.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        status: resolveAttendanceStatus(item, item.tanggal),
      }))

      const nextAvailableDates = normalized.map((item) => item.tanggal)
      setData(normalized)
      setAvailableDates(nextAvailableDates)
    } catch (error) {
      console.log("Gagal memuat riwayat kehadiran:", error)
      setData([])
      setAvailableDates([])
    } finally {
      setRefreshing(false)
    }
  }, [resolveAttendanceStatus])

  useFocusEffect(
    useCallback(() => {
      const today = getLocalDateValue()
      setSelectedDate(today)
      setCalendarMonth(today.slice(0, 7))
    }, [])
  )

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
    setCalendarMonth((prev) => shiftMonthValue(prev, offset))
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
    const normalized = resolveAttendanceStatus(status ? { status } : null)
    if (normalized === "hadir") return "#22C55E"
    if (normalized === "izin") return "#2563EB"
    if (normalized === "sakit") return "#EAB308"
    if (normalized === "tidak hadir") return AppTheme.colors.danger
    if (normalized === "belum ada data") return AppTheme.colors.textMuted
    return "#94A3B8"
  }

  const getStatusLabel = (status: string | null | undefined) => {
    const normalized = resolveAttendanceStatus(status ? { status } : null)
    if (normalized === "hadir") return "Hadir"
    if (normalized === "izin") return "Izin"
    if (normalized === "sakit") return "Sakit"
    if (normalized === "belum ada data") return "Belum Ada Data"
    return "Tidak Hadir"
  }

  const getAttendanceByDate = (tanggal: string) => {
    const found = data.find((item) => item.tanggal === tanggal)

    if (found) {
      return {
        ...found,
        status: resolveAttendanceStatus(found, tanggal),
      }
    }

    return {
      id: `fallback-${tanggal}`,
      tanggal,
      waktu: null,
      status: resolveAttendanceStatus(null, tanggal),
    }
  }

  const selectedAttendance = getAttendanceByDate(selectedDate)
  const openCalendar = () => {
    setCalendarMonth(selectedDate.slice(0, 7))
    setCalendarVisible(true)
  }

  const selectDate = (dateValue: string, closeAfterSelect = false) => {
    setSelectedDate(dateValue)
    setCalendarMonth(dateValue.slice(0, 7))

    if (closeAfterSelect) {
      setCalendarVisible(false)
    }
  }

  return (
    <ScreenShell
      scroll
      footer={<UserBottomNav activeKey="riwayat_kehadiran" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <View style={styles.shell}>
          <PageHeader eyebrow="Kalender pribadi" title="Riwayat Kehadiran" onBackPress={handleBack} />

          <InfoCard
            title="Rekap kehadiran per bulan"
            description="Pilih bulan dari kalender untuk melihat status hadir, izin, sakit, atau tidak hadir."
          />

          <>
              <View style={styles.detailCard}>
                <View style={styles.detailHeaderRow}>
                  <View style={styles.detailHeaderCopy}>
                    <Text style={styles.detailLabel}>Tanggal dipilih</Text>
                    <Text style={styles.detailDate}>{formatTanggal(selectedDate)}</Text>
                  </View>
                  <TouchableOpacity style={styles.secondaryActionInline} onPress={openCalendar}>
                    <Ionicons name="calendar-outline" size={18} color="#16324f" />
                    <Text style={styles.secondaryActionText}>Pilih Bulan</Text>
                  </TouchableOpacity>
                </View>
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
                    const hasData = availableDates.includes(item)
                    const itemStatus = hasData ? getAttendanceByDate(item)?.status : null

                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.calendarCell, selected && styles.calendarCellActive]}
                        onPress={() => selectDate(item)}
                      >
                        <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                          {item.slice(-2).replace(/^0/, "")}
                        </Text>
                        {hasData ? <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} /> : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
          </>
        </View>
      

      <Modal transparent animationType="fade" visible={calendarVisible} onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <ModalCard>
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
                const hasData = availableDates.includes(item)
                const itemStatus = hasData ? getAttendanceByDate(item)?.status : null

                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.calendarCell, selected && styles.calendarCellActive]}
                    onPress={() => selectDate(item, true)}
                  >
                    <Text style={[styles.calendarCellText, selected && styles.calendarCellTextActive]}>
                      {item.slice(-2).replace(/^0/, "")}
                    </Text>
                    {hasData ? <View style={[styles.calendarDot, { backgroundColor: getStatusColor(itemStatus) }]} /> : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          </ModalCard>
        </View>
      </Modal>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  shell: {
    paddingBottom: 8,
  },
  secondaryActionInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  secondaryActionText: {
    color: AppTheme.colors.primary,
    fontWeight: "700",
  },
  detailCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginBottom: 14,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  detailHeaderCopy: {
    flex: 1,
  },
  detailLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  detailDate: {
    color: AppTheme.colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  detailTime: {
    color: AppTheme.colors.textMuted,
    marginTop: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: AppTheme.radius.pill,
  },
  statusBadgeText: {
    fontWeight: "800",
  },
  calendarPreview: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  weekLabel: {
    width: "14.28%",
    textAlign: "center",
    color: AppTheme.colors.textMuted,
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
    backgroundColor: AppTheme.colors.primary,
  },
  calendarCellText: {
    color: AppTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  calendarCellTextActive: {
    color: AppTheme.colors.white,
  },
  calendarDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalEyebrow: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  modalTitle: {
    color: AppTheme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
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
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  calendarNav: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
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
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.md,
    overflow: "hidden",
    backgroundColor: AppTheme.colors.surface,
  },
})
