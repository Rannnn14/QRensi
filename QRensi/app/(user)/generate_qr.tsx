import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert
} from "react-native";

import { supabase } from "../../lib/supabase";
import QRCode from "react-native-qrcode-svg";

import * as MediaLibrary from "expo-media-library";
import ViewShot from "react-native-view-shot";

type Profile = {
  id: string;
  nama: string;
  kelas: string;
};

export default function GenerateQR() {

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrReady, setQrReady] = useState(false);

  const viewShotRef = useRef<ViewShot | null>(null);

  // ======================
  // FETCH PROFILE
  // ======================
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,nama,kelas")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(data);
      }
    } catch (err: any) {
      console.log(err.message || err);
      setProfile(null);
    }
    setLoading(false);
  };

  // ======================
  // DOWNLOAD QR
  // ======================
  const downloadQR = async () => {
    if (!viewShotRef.current) {
      Alert.alert("QR belum siap");
      return;
    }

    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Izin galeri ditolak");
        return;
      }

      // capture QR card
      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert("Gagal mengambil QR");
        return;
      }

      // simpan langsung ke galeri
      await MediaLibrary.createAssetAsync(uri);

      Alert.alert("Berhasil", "QR berhasil disimpan ke galeri");

    } catch (err) {
      console.log(err);
      Alert.alert("Gagal menyimpan QR");
    }
  };

  // ======================
  // REALTIME UPDATE
  // ======================
  useEffect(() => {
    fetchProfile();

    let subscription: any = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      subscription = supabase
        .channel("realtime-profile-" + user.id)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`
          },
          () => fetchProfile()
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  // ======================
  // LOADING
  // ======================
  if (loading)
    return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  if (!profile)
    return (
      <View style={styles.empty}>
        <Text>Tidak ada data QR untuk akun ini.</Text>
      </View>
    );

  // ======================
  // UI
  // ======================
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1 }}
        onCapture={() => setQrReady(true)}
      >
        <View style={styles.card}>
          <Text style={styles.title}>KARTU QR SISWA</Text>
          <Text style={styles.name}>{profile.nama}</Text>
          <Text style={styles.kelas}>{profile.kelas}</Text>
          <View style={styles.qrBox}>
            <QRCode value={profile.id} size={200} />
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity
        style={[styles.button, !qrReady && { opacity: 0.5 }]}
        onPress={downloadQR}
        disabled={!qrReady}
      >
        <Text style={styles.buttonText}>Download QR + Nama + Kelas</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ======================
// STYLE
// ======================
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f1f5f9"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    width: 300,
    elevation: 6
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  name: { fontSize: 20, fontWeight: "bold" },
  kelas: { fontSize: 14, color: "#555", marginBottom: 15 },
  qrBox: { padding: 10, backgroundColor: "#fff", borderRadius: 10 },
  button: {
    marginTop: 25,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" }
});
