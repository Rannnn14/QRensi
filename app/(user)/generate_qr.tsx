import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";

import { supabase } from "../../lib/supabase";
import QRCode from "react-native-qrcode-svg";
import { UserBottomNav } from "../../components/user-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { saveImageToGallery, writeBase64ImageToCache } from "../../lib/device-files";
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
  const [downloading, setDownloading] = useState(false);

  const qrCodeRef = useRef<any>(null);
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

  // ======================
  // FETCH PROFILE
  // ======================
  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        return;
      }

      const fallbackName = user.email ? user.email.split("@")[0] : "Siswa";
      const fallbackClass = String(user.user_metadata?.class_name || user.user_metadata?.kelas || "-");

      const { data, error } = await supabase
        .from("profiles")
        .select("id,nama,kelas")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProfile({
        id: user.id,
        nama: data?.nama || fallbackName,
        kelas: data?.kelas || fallbackClass,
      });
    } catch (err: any) {
      console.log(err.message || err);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setProfile({
          id: user.id,
          nama: user.email ? user.email.split("@")[0] : "Siswa",
          kelas: String(user.user_metadata?.class_name || user.user_metadata?.kelas || "-"),
        });
      } else {
        setProfile(null);
      }
    }
  };

  // ======================
  // DOWNLOAD QR
  // ======================
  const downloadQR = async () => {
    if (!qrCodeRef.current) {
      Alert.alert("QR belum siap");
      return;
    }

    try {
      setDownloading(true);

      const fileName = `qr_${profile?.nama?.replace(/\s+/g, "_").toLowerCase() || "siswa"}.png`;
      const qrBase64 = await new Promise<string>((resolve, reject) => {
        try {
          qrCodeRef.current?.toDataURL?.((data: string) => {
            if (!data) {
              reject(new Error("QR kosong"));
              return;
            }

            resolve(data);
          });
        } catch (error) {
          reject(error);
        }
      });

      if (Platform.OS === "web") {
        const response = await fetch(`data:image/png;base64,${qrBase64}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const tempUri = await writeBase64ImageToCache(fileName, qrBase64);
        await saveImageToGallery(tempUri);

        Alert.alert("Berhasil", "QR berhasil disimpan ke galeri.");
        return;
      }

      Alert.alert("Berhasil", "QR berhasil disimpan ke galeri.");

    } catch (err: any) {
      console.log(err);
      Alert.alert("Gagal menyimpan QR", err?.message || "Terjadi kesalahan saat menyimpan QR.");
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
  if (profile?.kelas?.trim().toLowerCase() === "alumni") {
    return (
      <ScreenShell scroll footer={<UserBottomNav activeKey="generate_qr" />}>
        <View style={styles.shell}>
          <PageHeader eyebrow="Kartu QR siswa" title="Kode QR" onBackPress={handleBack} />
          <InfoCard
            title="Akses Ditolak"
            description="Alumni tidak memiliki akses untuk fitur absensi."
          />
        </View>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell scroll footer={<UserBottomNav activeKey="generate_qr" />}>
        <View style={styles.shell}>
        <PageHeader eyebrow="Kartu QR siswa" title="Kode QR" onBackPress={handleBack} />

        <InfoCard
          title="Kartu digital siswa"
          description="QR ini dapat disimpan ke galeri lalu dicetak untuk proses pemindaian harian."
        />

        <View style={styles.card}>
          <Text style={styles.title}>KARTU QR SISWA</Text>
          <Text style={styles.name}>{profile?.nama || "-"}</Text>
          <Text style={styles.kelas}>{profile?.kelas || "-"}</Text>
          <View style={styles.qrBox}>
            {profile ? (
              <QRCode
                value={profile.id}
                size={200}
                getRef={(ref) => {
                  qrCodeRef.current = ref;
                }}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>
                  QR belum tersedia
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.caption}>
            {profile
              ? "Cetak QR ini dan simpan di holder kartu siswa untuk pemindaian harian."
              : "Tidak dapat memuat data QR untuk akun ini."}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, (downloading || !profile) && { opacity: 0.5 }]}
            onPress={downloadQR}
            disabled={downloading || !profile}
          >
            <Text style={styles.buttonText}>
              {downloading ? "Mengunduh..." : "Unduh QR"}
            </Text>
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
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: 20,
  },
  qrPlaceholderText: {
    color: AppTheme.colors.textMuted,
    textAlign: "center",
  },
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
});
