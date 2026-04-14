import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";

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
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Review admin</Text>
            <Text style={styles.title}>Daftar Pengajuan</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Permintaan yang menunggu persetujuan</Text>
          <Text style={styles.infoText}>Setujui atau tolak pengajuan siswa tanpa mengubah alur sistem absensi lain.</Text>
        </View>

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
      </ScrollView>
      <Modal transparent animationType="fade" visible={!!previewUrl} onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewUrl(null)}>
              <Ionicons name="close" size={18} color="#16324f" />
            </TouchableOpacity>
            {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
          </View>
        </View>
      </Modal>
      <AdminBottomNav activeKey="pengajuan" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  shell: { paddingBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#dbe7f4", justifyContent: "center", alignItems: "center" },
  headerTextWrap: { marginLeft: 12 },
  eyebrow: { color: "#6d7e90", fontSize: 12, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: "#11263c" },
  infoCard: { backgroundColor: "#16324f", borderRadius: 24, padding: 16, marginBottom: 16 },
  infoTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  infoText: { marginTop: 6, color: "#c7d8e9", fontSize: 12, lineHeight: 18 },
  noDataText: { textAlign: "center", fontSize: 16, color: "#6d7e90" },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  topBadgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 },
  userName: { fontSize: 18, fontWeight: "800", color: "#11263c", flex: 1 },
  typePill: { backgroundColor: "#dbe7f4", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  typePillText: { color: "#16324f", fontWeight: "700", textTransform: "capitalize" },
  userInfo: { fontSize: 14, marginBottom: 8, color: "#6d7e90" },
  keterangan: { fontSize: 15, marginBottom: 14, color: "#555", lineHeight: 20 },
  proofButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dbe7f4",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  proofButtonText: { color: "#16324f", fontWeight: "700" },
  noProofText: { color: "#6d7e90", marginBottom: 14 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between" },
  approveButton: {
    flex: 1,
    backgroundColor: "#1e8c5d",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginRight: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#c04444",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginLeft: 5,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  disabledButton: { backgroundColor: "#aaa" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 38, 60, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  modalClose: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#dbe7f4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: 360,
    borderRadius: 16,
    backgroundColor: "#f4f7fb",
  },
});
