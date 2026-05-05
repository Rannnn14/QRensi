import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { SectionHeader } from "../../components/ui/section-header";
import { UserBottomNav } from "../../components/user-bottom-nav";
import { AppTheme } from "../../constants/theme";
import { getLocalDateValue } from "../../lib/date";
import { prepareNotifications, sendLocalNotification } from "../../lib/notifications";
import {
  formatSubmissionTime,
  getDefaultAttendanceStatus,
  getSubmissionDisplayType,
  getSubmissionStatusLabel,
  isTodaySubmission,
  PASSWORD_REQUEST_TYPE,
} from "../../lib/pengajuan";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

type ProfileState = {
  name: string
  kelas: string
};

type AttendanceState = {
  status: string
  waktu: string
};

type SubmissionState = {
  id: string
  jenis: string
  status: string
  created_at: string
};

const quickActions = [
  {
    title: "Riwayat Kehadiran",
    description: "Lihat catatan presensi sebelumnya",
    icon: "time-outline" as const,
    action: () => router.push("/riwayat_kehadiran" as any),
  },
  {
    title: "Ajukan Izin",
    description: "Izin, sakit, dan riwayat pengajuan",
    icon: "document-text-outline" as const,
    action: () => router.push("/ajuan" as any),
  },
  {
    title: "Lihat Kode QR",
    description: "Unduh kartu untuk cetak",
    icon: "qr-code-outline" as const,
    action: () => router.push("/generate_qr" as any),
  },
  {
    title: "Status Kehadiran",
    description: "Lihat hasil hari ini",
    icon: "checkmark-done-outline" as const,
    action: () => router.push("/status_kehadiran" as any),
  },
];

export default function User() {
  const [profile, setProfile] = useState<ProfileState>({ name: "", kelas: "-" });
  const [attendance, setAttendance] = useState<AttendanceState>({
    status: getDefaultAttendanceStatus(),
    waktu: "--:--",
  });
  const [refreshing, setRefreshing] = useState(false);
  const [todaySubmissions, setTodaySubmissions] = useState<SubmissionState[]>([]);

  useEffect(() => {
    prepareNotifications();
    let profileChannel: any = null;
    let attendanceChannel: any = null;
    let submissionChannel: any = null;

    const loadTodaySubmissions = async (userId: string) => {
      const { data: submissionData } = await supabaseAdmin
        .from("pengajuan")
        .select("id, jenis, status, created_at")
        .eq("user_id", userId)
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false })

      const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
      setTodaySubmissions(filtered as SubmissionState[]);
    };

    const applyFallbackAttendance = () => {
      const fallbackStatus = getDefaultAttendanceStatus()
      setAttendance((prev) =>
        prev.status === "Belum Absen" || prev.status === "Tidak Hadir"
          ? { ...prev, status: fallbackStatus }
          : prev
      )
      setTodaySubmissions((prev) => prev.filter((item) => isTodaySubmission(item.created_at)))
    };

    const loadDashboard = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) return

      const fallbackName = user.email ? user.email.split("@")[0] : "User"
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nama, kelas")
        .eq("id", user.id)
        .single()

      setProfile({
        name: profileData?.nama || fallbackName,
        kelas: profileData?.kelas || "-",
      })

      const today = getLocalDateValue()
      const { data: attendanceData } = await supabaseAdmin
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .maybeSingle()

      setAttendance({
        status: attendanceData?.status || getDefaultAttendanceStatus(),
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      await loadTodaySubmissions(user.id)

      profileChannel = supabase
        .channel("realtime-user-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload: { new?: { nama?: string; kelas?: string } }) => {
            setProfile((prev) => ({
              name: payload.new?.nama || prev.name,
              kelas: payload.new?.kelas || prev.kelas,
            }))
          }
        )
        .subscribe()

      attendanceChannel = supabase
        .channel("realtime-attendance-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "absensi", filter: `user_id=eq.${user.id}` },
          (payload: { new?: { status?: string; created_at?: string; tanggal?: string } }) => {
            if (payload.new?.tanggal !== getLocalDateValue()) return

            const latestTime = payload.new?.created_at
              ? new Date(payload.new.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"

            setAttendance({
              status: payload.new?.status || getDefaultAttendanceStatus(),
              waktu: latestTime,
            })
            sendLocalNotification(
              "Update kehadiran",
              `Status kamu sekarang ${payload.new?.status || getDefaultAttendanceStatus()} pada ${latestTime}.`
            )
          }
        )
        .subscribe()

      submissionChannel = supabase
        .channel("realtime-submission-" + user.id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pengajuan", filter: `user_id=eq.${user.id}` },
          () => {
            loadTodaySubmissions(user.id)
          }
        )
        .subscribe()
    }

    loadDashboard();
    const cutoffWatcher = setInterval(applyFallbackAttendance, 30000);

    return () => {
      clearInterval(cutoffWatcher);
      if (profileChannel) supabase.removeChannel(profileChannel);
      if (attendanceChannel) supabase.removeChannel(attendanceChannel);
      if (submissionChannel) supabase.removeChannel(submissionChannel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true)
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (user) {
      const fallbackName = user.email ? user.email.split("@")[0] : "User"
      const { data: profileData } = await supabase
        .from("profiles")
        .select("nama, kelas")
        .eq("id", user.id)
        .single()

      setProfile({
        name: profileData?.nama || fallbackName,
        kelas: profileData?.kelas || "-",
      })

      const today = getLocalDateValue()
      const { data: attendanceData } = await supabaseAdmin
        .from("absensi")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("tanggal", today)
        .maybeSingle()

      setAttendance({
        status: attendanceData?.status || getDefaultAttendanceStatus(),
        waktu: attendanceData?.created_at
          ? new Date(attendanceData.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
      })

      const { data: submissionData } = await supabaseAdmin
        .from("pengajuan")
        .select("id, jenis, status, created_at")
        .eq("user_id", user.id)
        .neq("jenis", PASSWORD_REQUEST_TYPE)
        .order("created_at", { ascending: false })

      const filtered = (submissionData || []).filter((item) => isTodaySubmission(item.created_at))
      setTodaySubmissions(filtered as SubmissionState[])
    }
    setRefreshing(false);
  };

  const normalizedStatus = attendance.status.toLowerCase();

  const statusColor =
    normalizedStatus === "hadir"
      ? AppTheme.colors.success
      : normalizedStatus === "izin" || normalizedStatus === "sakit"
        ? AppTheme.colors.warning
        : normalizedStatus === "tidak hadir"
          ? AppTheme.colors.danger
          : AppTheme.colors.info;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.backgroundShapeTop} />
        <View style={styles.backgroundShapeSide} />
        <View style={styles.backgroundShapeBottom} />
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.topCopy}>
            <Image source={require("../../assets/images/logo_qrensii.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.eyebrow}>Dashboard siswa</Text>
            <Text style={styles.pageTitle}>Beranda</Text>
            <Text style={styles.subtitle}>Ringkasan presensi, pengajuan, dan kartu QR dalam satu halaman.</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onRefresh} disabled={refreshing}>
              <Ionicons
                name={refreshing ? "hourglass-outline" : "refresh-outline"}
                size={18}
                color={AppTheme.colors.primary}
              />
            </TouchableOpacity>
            <AppButton
              label="Keluar"
              icon="log-out-outline"
              onPress={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              style={styles.logoutButton}
            />
          </View>
        </View>

        <AppCard style={styles.profileCard}>
          <View style={styles.profileCopy}>
            <Text style={styles.mutedLabel}>Profil Siswa</Text>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>Kelas {profile.kelas}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Aktif</Text>
          </View>
        </AppCard>

        <TouchableOpacity style={styles.noticeCard} onPress={() => router.push("/ajuan" as any)} activeOpacity={0.92}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Riwayat Pengajuan Hari Ini</Text>
            <Text style={styles.noticeMeta}>{todaySubmissions.length} item</Text>
          </View>
          {todaySubmissions.length === 0 ? (
            <Text style={styles.noticeEmpty}>
              Belum ada pengajuan hari ini. Riwayat di kartu ini akan otomatis kosong saat berganti hari.
            </Text>
          ) : (
            todaySubmissions.map((item) => (
              <View key={item.id} style={styles.noticeItem}>
                <View style={styles.noticeIconWrap}>
                  <Ionicons name="document-text-outline" size={16} color={AppTheme.colors.primary} />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeItemTitle}>{getSubmissionDisplayType(item.jenis)}</Text>
                  <Text style={styles.noticeText}>
                    Status: {getSubmissionStatusLabel(item.status)}
                  </Text>
                  <Text style={styles.noticeText}>
                    Jam pengajuan: {formatSubmissionTime(item.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => router.push("/status_kehadiran" as any)}
          activeOpacity={0.94}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Kehadiran hari ini</Text>
            <Text style={styles.heroTime}>
              {attendance.waktu === "--:--" ? "Belum presensi" : `Presensi ${attendance.waktu}`}
            </Text>
          </View>
          <View style={styles.heroStatusPill}>
            <Text style={styles.heroStatusText}>{attendance.status}</Text>
          </View>
          <Text style={styles.heroHelper}>
            Ringkasan status kehadiran tampil otomatis dan terhubung real-time.
          </Text>
        </TouchableOpacity>

        <View style={styles.quickSection}>
          <SectionHeader title="Akses cepat" hint="Jalur utama untuk aktivitas siswa" />
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={styles.quickCard}
                onPress={item.action}
                activeOpacity={0.92}
              >
                <View style={styles.quickIconWrap}>
                  <Ionicons name={item.icon} size={18} color={AppTheme.colors.primary} />
                </View>
                <Text style={styles.quickTitle}>{item.title}</Text>
                <Text style={styles.quickDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <AppCard tone="muted" style={styles.detailCard}>
          <Text style={styles.detailTitle}>Ringkasan Hari Ini</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailValue, { color: statusColor }]}>{attendance.status}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Kelas</Text>
            <Text style={styles.detailValue}>{profile.kelas}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Metode</Text>
            <Text style={styles.detailValue}>Pindai QR</Text>
          </View>
        </AppCard>
      </ScrollView>
      <UserBottomNav activeKey="user" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
    position: "relative",
    overflow: "hidden",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundShapeTop: {
    position: "absolute",
    top: -112,
    right: -104,
    width: 288,
    height: 260,
    borderRadius: 60,
    backgroundColor: AppTheme.colors.primarySoft,
    opacity: 0.72,
    transform: [{ rotate: "16deg" }],
  },
  backgroundShapeSide: {
    position: "absolute",
    top: 186,
    left: -120,
    width: 220,
    height: 314,
    borderRadius: 54,
    backgroundColor: AppTheme.colors.surfaceMuted,
    opacity: 0.9,
    transform: [{ rotate: "-12deg" }],
  },
  backgroundShapeBottom: {
    position: "absolute",
    right: -88,
    bottom: 118,
    width: 228,
    height: 152,
    borderRadius: 40,
    backgroundColor: AppTheme.colors.primarySoft,
    opacity: 0.32,
    transform: [{ rotate: "-16deg" }],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: AppTheme.spacing.lg,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: AppTheme.spacing["2xl"],
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: AppTheme.spacing.md,
    marginBottom: AppTheme.spacing.lg,
    flexWrap: "wrap",
  },
  topCopy: {
    flex: 1,
    minWidth: 150,
  },
  logo: {
    width: 116,
    height: 42,
    marginBottom: AppTheme.spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  eyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
    marginBottom: AppTheme.spacing.xs,
  },
  pageTitle: {
    ...AppTheme.typography.title,
  },
  subtitle: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
    color: AppTheme.colors.textMuted,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    minWidth: 104,
  },
  profileCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: AppTheme.spacing.md,
  },
  profileCopy: {
    flex: 1,
  },
  noticeCard: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.lg,
    marginTop: AppTheme.spacing.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  noticeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: AppTheme.spacing.md,
  },
  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeMeta: {
    color: AppTheme.colors.primary,
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  noticeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AppTheme.spacing.md,
    paddingTop: AppTheme.spacing.md,
    paddingBottom: AppTheme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    ...AppTheme.typography.titleSm,
  },
  noticeText: {
    ...AppTheme.typography.bodySm,
  },
  noticeItemTitle: {
    ...AppTheme.typography.bodyStrong,
    marginBottom: 2,
  },
  noticeEmpty: {
    ...AppTheme.typography.bodySm,
  },
  mutedLabel: {
    ...AppTheme.typography.label,
    color: AppTheme.colors.textMuted,
    marginBottom: AppTheme.spacing.xs,
  },
  profileName: {
    ...AppTheme.typography.title,
  },
  profileMeta: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
    color: AppTheme.colors.textMuted,
  },
  statusBadge: {
    backgroundColor: AppTheme.colors.primarySoft,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.pill,
  },
  statusBadgeText: {
    color: AppTheme.colors.primary,
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  heroCard: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.lg,
    minHeight: 136,
    justifyContent: "space-between",
    marginTop: AppTheme.spacing.md,
    ...AppTheme.shadow.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: AppTheme.spacing.md,
    gap: AppTheme.spacing.sm,
  },
  heroLabel: {
    ...AppTheme.typography.label,
    color: "#D2E1EF",
  },
  heroTime: {
    color: "#b2c6db",
    fontFamily: AppTheme.fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  heroStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.primaryMuted,
  },
  heroStatusText: {
    color: AppTheme.colors.white,
    fontFamily: AppTheme.fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    textTransform: "capitalize",
  },
  heroHelper: {
    marginTop: AppTheme.spacing.sm,
    color: "#bdd0e2",
    fontFamily: AppTheme.fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  quickSection: {
    marginTop: AppTheme.spacing.lg,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: AppTheme.spacing.md,
    columnGap: AppTheme.spacing.md,
  },
  quickCard: {
    flexBasis: "48%",
    maxWidth: "48.5%",
    flexGrow: 1,
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: AppTheme.spacing.md,
    minHeight: 116,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    marginBottom: AppTheme.spacing.md,
  },
  quickTitle: {
    ...AppTheme.typography.titleSm,
  },
  quickDescription: {
    ...AppTheme.typography.bodySm,
    marginTop: AppTheme.spacing.xs,
  },
  detailCard: {
    marginTop: AppTheme.spacing.lg,
    gap: AppTheme.spacing.xs,
  },
  detailTitle: {
    ...AppTheme.typography.titleSm,
    marginBottom: AppTheme.spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: AppTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.colors.border,
  },
  detailLabel: {
    ...AppTheme.typography.bodySm,
  },
  detailValue: {
    ...AppTheme.typography.bodyStrong,
    textTransform: "capitalize",
  },
});
