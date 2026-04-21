import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";

import { supabase } from "../../lib/supabase";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserBottomNav } from "../../components/user-bottom-nav";
import ViewShot from "react-native-view-shot";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { saveImageToGallery } from "../../lib/device-files";

type Profile = {
  id: string;
  nama: string;
  kelas: string;
};

export default function GenerateQR() {

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const viewShotRef = useRef<ViewShot | null>(null);
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

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
      setDownloading(true);

      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        Alert.alert("Gagal mengambil QR");
        return;
      }

      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `qr_${profile?.nama?.replace(/\s+/g, "_").toLowerCase() || "siswa"}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        await saveImageToGallery(uri);
      }

      Alert.alert("Berhasil", "QR berhasil disimpan ke galeri.");

    } catch (err) {
      console.log(err);
      Alert.alert("Gagal menyimpan QR");
    } finally {
      setDownloading(false);
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
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Kartu QR siswa</Text>
            <Text style={styles.pageTitle}>Kode QR</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Kartu digital siswa</Text>
          <Text style={styles.infoText}>QR ini dapat disimpan ke galeri lalu dicetak untuk proses pemindaian harian.</Text>
        </View>

        <ViewShot
          ref={viewShotRef}
          options={{ format: "png", quality: 1 }}
        >
          <View style={styles.card}>
            <Text style={styles.title}>KARTU QR SISWA</Text>
            <Text style={styles.name}>{profile.nama}</Text>
            <Text style={styles.kelas}>{profile.kelas}</Text>
            <View style={styles.qrBox}>
              <QRCode value={profile.id} size={200} />
            </View>
            <Text style={styles.caption}>Cetak QR ini dan simpan di holder kartu siswa untuk pemindaian harian.</Text>
          </View>
        </ViewShot>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, downloading && { opacity: 0.5 }]}
            onPress={downloadQR}
            disabled={downloading}
          >
            <Text style={styles.buttonText}>{downloading ? "Mengunduh..." : "Unduh QR"}</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
      <UserBottomNav activeKey="generate_qr" />
    </SafeAreaView>
  );
}

// ======================
// STYLE
// ======================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f7fb"
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
  },
  eyebrow: {
    color: "#6d7e90",
    fontSize: 12,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11263c",
  },
  infoCard: {
    backgroundColor: "#16324f",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 25,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10, color: "#11263c" },
  name: { fontSize: 20, fontWeight: "bold", color: "#11263c" },
  kelas: { fontSize: 14, color: "#6d7e90", marginBottom: 15 },
  qrBox: { padding: 14, backgroundColor: "#fff", borderRadius: 18 },
  caption: {
    marginTop: 14,
    textAlign: "center",
    color: "#7A6F6F",
    lineHeight: 18,
    fontSize: 12,
  },
  buttonRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
  },
  button: {
    backgroundColor: "#16324f",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 16
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" }
});
