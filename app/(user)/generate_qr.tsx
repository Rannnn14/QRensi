import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";

import { supabase } from "../../lib/supabase";
import QRCode from "react-native-qrcode-svg";
import { UserBottomNav } from "../../components/user-bottom-nav";
import ViewShot from "react-native-view-shot";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { saveImageToGallery } from "../../lib/device-files";
import { AppTheme } from "../../constants/theme";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";

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
    <ScreenShell scroll footer={<UserBottomNav activeKey="generate_qr" />}>
        <View style={styles.shell}>
        <PageHeader eyebrow="Kartu QR siswa" title="Kode QR" onBackPress={handleBack} />

        <InfoCard
          title="Kartu digital siswa"
          description="QR ini dapat disimpan ke galeri lalu dicetak untuk proses pemindaian harian."
        />

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
    </ScreenShell>
  );
}

// ======================
// STYLE
// ======================
const styles = StyleSheet.create({
  shell: {
    paddingBottom: 8,
  },
  card: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    padding: 25,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10, color: AppTheme.colors.text },
  name: { fontSize: 20, fontWeight: "bold", color: AppTheme.colors.text },
  kelas: { fontSize: 14, color: AppTheme.colors.textMuted, marginBottom: 15 },
  qrBox: { padding: 14, backgroundColor: AppTheme.colors.surface, borderRadius: AppTheme.radius.md },
  caption: {
    marginTop: 14,
    textAlign: "center",
    color: AppTheme.colors.textMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  buttonRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
  },
  button: {
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: AppTheme.radius.md
  },
  buttonText: { color: AppTheme.colors.white, fontWeight: "bold", fontSize: 15 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: AppTheme.colors.background }
});
