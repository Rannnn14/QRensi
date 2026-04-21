import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { Ionicons } from "@expo/vector-icons";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { AppTheme } from "../../constants/theme";
import { InfoCard } from "../../components/ui/info-card";
import { ModalCard } from "../../components/ui/modal-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";

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

export default function PengajuanAdmin() {
  const [pengajuanList, setPengajuanList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    const filePath = `pengajuan/${pengajuanId}`;
    const { data, error } = await supabaseAdmin.storage
      .from("bukti-ajuan")
      .createSignedUrl(filePath, 3600);

    if (error) {
      return null;
    }

    return data?.signedUrl || null;
  };

  const fetchPengajuan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pengajuan")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const withProof = await Promise.all(
        (data || []).map(async (item) => ({
          ...item,
          buktiUrl: await getProofUrl(item.id),
        }))
      );

      setPengajuanList(withProof);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeProofFile = async (pengajuanId: string) => {
    await supabaseAdmin.storage.from("bukti-ajuan").remove([`pengajuan/${pengajuanId}`]);
  };

  // Real-time subscription
  useEffect(() => {
    let realtimeChannel: any;

    const setupRealtime = async () => {
      await fetchPengajuan(); // initial load
      realtimeChannel = supabase
        .channel("public:pengajuan")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pengajuan" },
          () => {
            fetchPengajuan(); // update UI saat ada perubahan
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, [fetchPengajuan]);

  const approvePengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Approve",
      `Apakah Anda yakin ingin approve pengajuan "${item.jenis}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);
              const today = new Date();
              const tanggal = today.toISOString().split("T")[0];
              const waktu = today.toTimeString().split(" ")[0];

              const { data: existingAbsensi, error: absensiError } = await supabase
                .from("absensi")
                .select("*")
                .eq("user_id", item.user_id)
                .eq("tanggal", tanggal)
                .single();

              if (absensiError && absensiError.code !== "PGRST116") throw absensiError;

              if (existingAbsensi) {
                await supabase
                  .from("absensi")
                  .update({ status: item.jenis })
                  .eq("id", existingAbsensi.id)
                  .throwOnError();
              } else {
                await supabase
                  .from("absensi")
                  .insert([{
                    user_id: item.user_id,
                    nama: item.nama,
                    kelas: item.kelas,
                    tanggal,
                    waktu,
                    status: item.jenis
                  }])
                  .throwOnError();
              }

              // Hapus pengajuan setelah approve
              await removeProofFile(item.id);
              await supabase.from("pengajuan").delete().eq("id", item.id).throwOnError();
              setPengajuanList(prev => prev.filter(p => p.id !== item.id));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const rejectPengajuan = async (item: Pengajuan) => {
    Alert.alert(
      "Konfirmasi Reject",
      `Apakah Anda yakin ingin menolak pengajuan "${item.jenis}" untuk ${item.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingId(item.id);
              await removeProofFile(item.id);
              await supabase.from("pengajuan").delete().eq("id", item.id).throwOnError();
              setPengajuanList(prev => prev.filter(p => p.id !== item.id));
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPengajuan();
    setRefreshing(false);
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} color="#6D3BFF" />;

  return (
    <ScreenShell
      scroll
      footer={<AdminBottomNav activeKey="pengajuan" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
      }}
    >
        <View style={styles.shell}>
        <PageHeader eyebrow="Review admin" title="Daftar Pengajuan" onBackPress={handleBack} />

        <InfoCard
          title="Permintaan yang menunggu persetujuan"
          description="Setujui atau tolak pengajuan siswa tanpa mengubah alur sistem absensi lain."
        />

        {pengajuanList.length === 0 && (
          <Text style={styles.noDataText}>Tidak ada pengajuan pending</Text>
        )}

        {pengajuanList.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={styles.topBadgeRow}>
              <Text style={styles.userName}>{item.nama}</Text>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{item.jenis}</Text>
              </View>
            </View>
            <Text style={styles.userInfo}>Kelas {item.kelas}</Text>
            <Text style={styles.keterangan}>{item.keterangan}</Text>

            {item.buktiUrl ? (
              <TouchableOpacity style={styles.proofButton} onPress={() => setPreviewUrl(item.buktiUrl || null)}>
                <Ionicons name="image-outline" size={16} color="#16324f" />
                <Text style={styles.proofButtonText}>Lihat Bukti Foto</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noProofText}>Belum ada bukti foto</Text>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.approveButton,
                  processingId === item.id && styles.disabledButton,
                ]}
                onPress={() => approvePengajuan(item)}
                disabled={processingId === item.id}
              >
                <Text style={styles.buttonText}>Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rejectButton,
                  processingId === item.id && styles.disabledButton,
                ]}
                onPress={() => rejectPengajuan(item)}
                disabled={processingId === item.id}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
  noDataText: { textAlign: "center", fontSize: 16, color: AppTheme.colors.textMuted },
  card: {
    backgroundColor: AppTheme.colors.surface,
    padding: 16,
    borderRadius: AppTheme.radius.lg,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  topBadgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 },
  userName: { fontSize: 18, fontWeight: "800", color: AppTheme.colors.text, flex: 1 },
  typePill: { backgroundColor: AppTheme.colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: AppTheme.radius.pill },
  typePillText: { color: AppTheme.colors.primary, fontWeight: "700", textTransform: "capitalize" },
  userInfo: { fontSize: 14, marginBottom: 8, color: AppTheme.colors.textMuted },
  keterangan: { fontSize: 15, marginBottom: 14, color: AppTheme.colors.text, lineHeight: 20 },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AppTheme.colors.primarySoft,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
    marginBottom: 14,
  },
  proofButtonText: { color: AppTheme.colors.primary, fontWeight: "700" },
  noProofText: { color: AppTheme.colors.textMuted, marginBottom: 14 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between" },
  approveButton: {
    flex: 1,
    backgroundColor: AppTheme.colors.success,
    paddingVertical: 12,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    marginRight: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: AppTheme.colors.danger,
    paddingVertical: 12,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    marginLeft: 5,
  },
  buttonText: { color: AppTheme.colors.white, fontWeight: "bold", fontSize: 16 },
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
