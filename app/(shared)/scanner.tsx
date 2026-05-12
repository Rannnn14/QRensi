import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { getLocalDateValue } from "../../lib/date";
import { AppTheme } from "../../constants/theme";
import { AppButton } from "../../components/ui/app-button";
import { InfoCard } from "../../components/ui/info-card";
import { PageHeader } from "../../components/ui/page-header";
import { ScreenShell } from "../../components/ui/screen-shell";
import { getSubmissionCutoffLabel, isPastSubmissionCutoff } from "../../lib/pengajuan";

export default function Scanner() {

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusColor, setStatusColor] = useState("");
  const handleBack = useFeatureBack({ fallbackRoute: "/admin" });
  const attendanceClosed = isPastSubmissionCutoff();

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={80} color="#4C6EF5" />
          <Text style={styles.permissionText}>Akses kamera diperlukan</Text>
          <AppButton label="Izinkan Kamera" onPress={requestPermission} style={styles.permissionButton} />
        </View>
      </View>
    );
  }

  const handleScan = async ({ data }: any) => {
    setScanned(true);

    if (attendanceClosed) {
      setStatusText(`Waktu kehadiran sudah habis. Pemindaian hanya tersedia sampai jam ${getSubmissionCutoffLabel()}.`);
      setStatusColor("#FA5252");
      return;
    }

    const uid = String(data || "").trim();

    if (!uid) {
      setStatusText("QR tidak valid");
      setStatusColor("#FA5252");
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      setStatusText("Siswa tidak ditemukan");
      setStatusColor("#FA5252");
      return;
    }

    const today = getLocalDateValue();

    const { data: cek, error: cekError } = await supabaseAdmin
      .from("absensi")
      .select("*")
      .eq("user_id", uid)
      .eq("tanggal", today)
      .maybeSingle();

    if (cekError) {
      setStatusText("Gagal memeriksa absensi");
      setStatusColor("#FA5252");
      return;
    }

    if (cek) {
      if (cek.status === "hadir") {
        setStatusText(profile.nama + " sudah hadir hari ini");
        setStatusColor("#FAB005");
        return;
      }

      const waktu = new Date().toTimeString().split(" ")[0];
      const { error: updateError } = await supabaseAdmin
        .from("absensi")
        .update({ status: "hadir", waktu })
        .eq("id", cek.id);

      if (updateError) {
        setStatusText("Gagal memperbarui absensi");
        setStatusColor("#FA5252");
        return;
      }

      setStatusText(profile.nama + " berhasil diubah menjadi hadir");
      setStatusColor("#40C057");
      return;
    }

    const waktu = new Date().toTimeString().split(" ")[0];

    const { error } = await supabaseAdmin
      .from("absensi")
      .insert({
        user_id: uid,
        nama: profile.nama,
        kelas: profile.kelas,
        tanggal: today,
        waktu,
        status: "hadir"
      });

    if (error) {
      setStatusText("Gagal menyimpan absensi");
      setStatusColor("#FA5252");
    } else {
      setStatusText(profile.nama + " berhasil absen");
      setStatusColor("#40C057");
    }
  };

  return (
    <ScreenShell viewProps={{ style: styles.container }} footer={<AdminBottomNav activeKey="scanner" />}>
      
        <View style={styles.header}>
          <PageHeader eyebrow="Pemindaian cepat" title="Pindai QR Absensi" onBackPress={handleBack} />
        </View>

        <InfoCard
          title="Arahkan kamera ke kartu QR siswa"
          description={
            attendanceClosed
              ? `Waktu kehadiran sudah habis. Pemindaian QR ditutup setelah jam ${getSubmissionCutoffLabel()}.`
              : `Sistem akan membaca kode dan langsung mencatat kehadiran bila data valid sebelum jam ${getSubmissionCutoffLabel()}.`
          }
        />

        <View style={styles.cameraContainer}>
          {attendanceClosed ? (
            <View style={styles.closedState}>
              <Ionicons name="time-outline" size={54} color={AppTheme.colors.danger} />
              <Text style={styles.closedTitle}>Waktu Kehadiran Sudah Habis</Text>
              <Text style={styles.closedText}>
                Pemindaian QR untuk absensi hari ini ditutup setelah jam {getSubmissionCutoffLabel()}.
              </Text>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"]
              }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            />
          )}
          {!attendanceClosed ? <View style={styles.scanFrame} /> : null}
        </View>

        {statusText !== "" && (
          <View style={[styles.statusBox, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        {scanned && (
          <AppButton
            label="Pindai Lagi"
            style={styles.button}
            onPress={() => {
              setScanned(false);
              setStatusText("");
            }}
          />
        )}

    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  camera: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },
  scanFrame: {
    position: "absolute",
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: AppTheme.colors.primarySoft,
    borderRadius: 24,
  },
  closedState: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  closedTitle: {
    marginTop: 16,
    color: AppTheme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  closedText: {
    marginTop: 10,
    color: AppTheme.colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  statusBox: {
    padding: 15,
    marginTop: 16,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
  },
  statusText: {
    color: AppTheme.colors.white,
    fontWeight: "bold",
    fontSize: 16,
  },
  button: {
    marginTop: 16,
  },
  permissionButton: {
    alignSelf: "stretch",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: AppTheme.colors.primary,
    padding: 20,
    justifyContent: "center",
  },
  permissionCard: {
    backgroundColor: AppTheme.colors.background,
    borderRadius: AppTheme.radius.xl,
    padding: 24,
    alignItems: "center",
  },
  permissionText: {
    fontSize: 16,
    marginVertical: 20,
    color: AppTheme.colors.text,
  },
});
