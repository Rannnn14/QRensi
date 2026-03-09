import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl
} from "react-native";
import { supabase } from "../lib/supabase";

type Pengajuan = {
  id: string;
  user_id: string;
  nama: string;
  kelas: string;
  jenis: string;
  keterangan: string;
  status: string;
  created_at: string;
};

export default function PengajuanAdmin() {
  const [pengajuanList, setPengajuanList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPengajuan = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pengajuan")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPengajuanList(data || []);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Daftar Pengajuan</Text>
      {pengajuanList.length === 0 && (
        <Text style={styles.noDataText}>Tidak ada pengajuan pending</Text>
      )}

      {pengajuanList.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.userInfo}>Nama: {item.nama}</Text>
          <Text style={styles.userInfo}>Kelas: {item.kelas}</Text>
          <Text style={styles.userInfo}>Jenis: {item.jenis}</Text>
          <Text style={styles.keterangan}>Keterangan: {item.keterangan}</Text>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#333" },
  noDataText: { textAlign: "center", fontSize: 16, color: "#777" },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginVertical: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  userInfo: { fontSize: 16, marginBottom: 4, color: "#333" },
  keterangan: { fontSize: 15, marginBottom: 10, color: "#555" },
  buttonRow: { flexDirection: "row", justifyContent: "space-between" },
  approveButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#F44336",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 5,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  disabledButton: { backgroundColor: "#aaa" },
});