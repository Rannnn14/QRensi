import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { AppTheme } from "../../constants/theme";
import { ModalCard } from "../../components/ui/modal-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import {
  cleanupExpiredSubmissions,
  formatSubmissionDateTime,
  formatSubmissionTime,
  getSubmissionDisplayNote,
  getSubmissionDisplayType,
  getSubmissionStatusLabel,
  isPasswordRequest,
  parsePasswordRequestNote,
} from "../../lib/pengajuan";

type Pengajuan = {
  id: string;
  user_id: string;
  nama: string;
  kelas: string;
  jenis: string;
  keterangan: string;
  status: string;
  created_at: string;
  buktiUrl?: string | null;
};

const getStatusColor = (status: string) => {
  if (status === "approved") return AppTheme.colors.success;
  if (status === "rejected") return AppTheme.colors.danger;
  return AppTheme.colors.warning;
};

export default function PengajuanAdmin() {
  const [pengajuanList, setPengajuanList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (previewUrl) {
        setPreviewUrl(null);
        return true;
      }

      return false;
    },
  });

  const getProofUrl = async (pengajuanId: string) => {
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("bukti-ajuan")
      .list("pengajuan", {
        search: pengajuanId,
      });

    if (listError) {
      return null;
    }

    const proofFile = files?.find(
      (file) => file.name === pengajuanId || file.name.startsWith(`${pengajuanId}.`)
    );

    if (!proofFile) {
      return null;
    }

    const filePath = `pengajuan/${proofFile.name}`;
    const { data, error } = await supabaseAdmin.storage
      .from("bukti-ajuan")
      .createSignedUrl(filePath, 3600);

    if (error) {
      return null;
    }

    return data?.signedUrl || null;
  };

  const fetchPengajuan = useCallback(async (showLoader = false) => {
    if (showLoader || !hasLoadedOnceRef.current) {
      setLoading(true);
    }

    try {
      await cleanupExpiredSubmissions();
      const { data, error } = await supabaseAdmin
        .from("pengajuan")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withProof = await Promise.all(
        (data || []).map(async (item) => ({
          ...item,
          buktiUrl: isPasswordRequest(item.jenis) ? null : await getProofUrl(item.id),
        }))
      );

      setPengajuanList(withProof);
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      Alert.alert("Kesalahan", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const schedulePengajuanRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      fetchPengajuan(false).catch(() => undefined);
    }, 250);
  }, [fetchPengajuan]);

  useEffect(() => {
    let realtimeChannel: any;

    const setupRealtime = async () => {
      await fetchPengajuan(true);
      realtimeChannel = supabase
        .channel("public:pengajuan")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pengajuan" },
          () => {
            schedulePengajuanRefresh();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [fetchPengajuan, schedulePengajuanRefresh]);

  const approvePengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Persetujuan",
      `Setujui pengajuan "${getSubmissionDisplayType(item.jenis)}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);

              if (isPasswordRequest(item.jenis)) {
                const passwordPayload = parsePasswordRequestNote(item.keterangan);
                if (!passwordPayload?.password) {
                  throw new Error("Data password baru tidak ditemukan.");
                }

                const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                  item.user_id,
                  { password: passwordPayload.password }
                );

                if (passwordError) throw passwordError;
              } else {
                const today = new Date();
                const tanggal = today.toISOString().split("T")[0];
                const waktu = today.toTimeString().split(" ")[0];

                const { data: existingAbsensi, error: absensiError } = await supabaseAdmin
                  .from("absensi")
                  .select("*")
                  .eq("user_id", item.user_id)
                  .eq("tanggal", tanggal)
                  .maybeSingle();

                if (absensiError) throw absensiError;

                if (existingAbsensi) {
                  await supabaseAdmin
                    .from("absensi")
                    .update({ status: item.jenis, waktu })
                    .eq("id", existingAbsensi.id)
                    .throwOnError();
                } else {
                  await supabaseAdmin
                    .from("absensi")
                    .insert([
                      {
                        user_id: item.user_id,
                        nama: item.nama,
                        kelas: item.kelas,
                        tanggal,
                        waktu,
                        status: item.jenis,
                      },
                    ])
                    .throwOnError();
                }
              }

              await supabaseAdmin
                .from("pengajuan")
                .update({ status: "approved" })
                .eq("id", item.id)
                .throwOnError();

              setPengajuanList((prev) => prev.filter((submission) => submission.id !== item.id));
              Alert.alert("Berhasil", "Pengajuan berhasil disetujui.");
            } catch (err: any) {
              Alert.alert("Kesalahan", err.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const rejectPengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Penolakan",
      `Tolak pengajuan "${getSubmissionDisplayType(item.jenis)}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);
              await supabaseAdmin
                .from("pengajuan")
                .update({ status: "rejected" })
                .eq("id", item.id)
                .throwOnError();

              setPengajuanList((prev) => prev.filter((submission) => submission.id !== item.id));
              Alert.alert("Berhasil", "Pengajuan berhasil ditolak.");
            } catch (err: any) {
              Alert.alert("Kesalahan", err.message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPengajuan(false);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScreenShell
      scroll
      footer={<AdminBottomNav activeKey="pengajuan" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
      <View style={styles.shell}>
        <PageHeader
          eyebrow="Tinjauan admin"
          title="Daftar Pengajuan"
          onBackPress={handleBack}
        />

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>Menunggu persetujuan</Text>
            <Text style={styles.summaryValue}>{pengajuanList.length} pengajuan</Text>
          </View>
          <Ionicons name="time-outline" size={20} color={AppTheme.colors.primary} />
        </View>

        {pengajuanList.length === 0 && !loading && (
          <Text style={styles.noDataText}>Tidak ada pengajuan yang menunggu.</Text>
        )}

        {pengajuanList.map((item) => {
          const statusColor = getStatusColor(item.status);

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.topBadgeRow}>
                <View style={styles.requestTitleWrap}>
                  <Text style={styles.userName} numberOfLines={1}>{item.nama}</Text>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    Kelas {item.kelas} • {formatSubmissionDateTime(item.created_at)}
                  </Text>
                </View>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{getSubmissionDisplayType(item.jenis)}</Text>
                </View>
              </View>

              <Text style={styles.timeLine}>Jam {formatSubmissionTime(item.created_at)}</Text>
              <Text style={styles.keterangan} numberOfLines={2}>
                {getSubmissionDisplayNote(item.jenis, item.keterangan)}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.footerMeta}>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>
                      {getSubmissionStatusLabel(item.status)}
                    </Text>
                  </View>
                  {item.buktiUrl ? (
                    <TouchableOpacity style={styles.proofButton} onPress={() => setPreviewUrl(item.buktiUrl || null)}>
                      <Ionicons name="image-outline" size={14} color="#16324f" />
                      <Text style={styles.proofButtonText}>Bukti</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.noProofChip}>
                      <Text style={styles.noProofText}>
                        {isPasswordRequest(item.jenis) ? "Tanpa bukti" : "Belum ada bukti"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.approveButton, processingId === item.id && styles.disabledButton]}
                    onPress={() => approvePengajuan(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="checkmark" size={15} color={AppTheme.colors.white} />
                    <Text style={styles.buttonText}>Setujui</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.rejectButton, processingId === item.id && styles.disabledButton]}
                    onPress={() => rejectPengajuan(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="close" size={15} color={AppTheme.colors.white} />
                    <Text style={styles.buttonText}>Tolak</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <Modal transparent animationType="fade" visible={!!previewUrl} onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewUrl(null)}>
              <Ionicons name="close" size={18} color="#16324f" />
            </TouchableOpacity>
            {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
          </ModalCard>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: { paddingBottom: 8 },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    ...AppTheme.shadow.sm,
  },
  summaryLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  summaryValue: {
    color: AppTheme.colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  noDataText: { textAlign: "center", fontSize: 14, color: AppTheme.colors.textMuted },
  card: {
    backgroundColor: AppTheme.colors.surface,
    padding: 12,
    borderRadius: AppTheme.radius.md,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  topBadgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 10 },
  requestTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  userName: { fontSize: 15, fontWeight: "800", color: AppTheme.colors.text },
  metaLine: {
    color: AppTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  typePill: { backgroundColor: AppTheme.colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: AppTheme.radius.pill },
  typePillText: { color: AppTheme.colors.primary, fontWeight: "800", fontSize: 11 },
  timeLine: { fontSize: 11, marginBottom: 5, color: AppTheme.colors.primaryMuted, fontWeight: "700" },
  keterangan: { fontSize: 12, marginBottom: 10, color: AppTheme.colors.text, lineHeight: 17 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  footerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: AppTheme.radius.pill,
  },
  statusPillText: {
    fontWeight: "800",
    fontSize: 10,
  },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: AppTheme.colors.primarySoft,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: AppTheme.radius.pill,
  },
  proofButtonText: { color: AppTheme.colors.primary, fontWeight: "800", fontSize: 10 },
  noProofChip: {
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  noProofText: { color: AppTheme.colors.textMuted, fontWeight: "700", fontSize: 10 },
  buttonRow: { flexDirection: "row", gap: 6 },
  approveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppTheme.colors.success,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: AppTheme.radius.sm,
  },
  rejectButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppTheme.colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: AppTheme.radius.sm,
  },
  buttonText: { color: AppTheme.colors.white, fontWeight: "800", fontSize: 11 },
  disabledButton: { backgroundColor: "#aaa" },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: 20,
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: 360,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.background,
  },
});
