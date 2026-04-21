import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Image } from "react-native";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserBottomNav } from "../../components/user-bottom-nav";
import * as ImagePicker from "expo-image-picker";
import { useFeatureBack } from "../../hooks/use-feature-back";

type UserProfile = {
  id: string;
  nama: string;
  kelas: string;
};

export default function Ajuan() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [jenis, setJenis] = useState<"izin" | "sakit">("izin");
  const [keterangan, setKeterangan] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState("");
  const [selectedMimeType, setSelectedMimeType] = useState("image/jpeg");
  const handleBack = useFeatureBack({ fallbackRoute: "/user" });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error("User tidak ditemukan");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id,nama,kelas")
          .eq("id", authData.user.id)
          .single();

        if (error) throw error;
        setUser(profile);

        // cek apakah sudah submit hari ini
        const today = new Date();
        today.setHours(0, 0, 0, 0); // jam 00:00 hari ini
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const { data: existing, error: existingError } = await supabase
          .from("pengajuan")
          .select("*")
          .eq("user_id", profile.id)
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());

        if (existingError) throw existingError;

        setAlreadySubmitted(existing && existing.length > 0);

      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, []);

  const submitAjuan = async () => {
    if (!user) return;
    if (!keterangan) return Alert.alert("Isi keterangan terlebih dahulu");
    if (alreadySubmitted) return Alert.alert("Anda sudah mengajukan hari ini");
    if (!selectedImageUri) return Alert.alert("Tambahkan bukti foto terlebih dahulu");

    try {
      setSubmitting(true);
      const payload = {
        user_id: user.id,
        nama: user.nama,
        kelas: user.kelas,
        jenis,
        keterangan,
        status: "pending",
      };

      let usedAdminClient = false;

      let { data: insertedData, error } = await supabase
        .from("pengajuan")
        .insert([payload])
        .select()
        .single();

      if (error && /row-level security/i.test(error.message || "")) {
        usedAdminClient = true;
        ({ data: insertedData, error } = await supabaseAdmin
          .from("pengajuan")
          .insert([payload])
          .select()
          .single());
      }

      if (error) throw error;

      const response = await fetch(selectedImageUri);
      const arrayBuffer = await response.arrayBuffer();
      const filePath = `pengajuan/${insertedData.id}`;

      const storageClient = usedAdminClient ? supabaseAdmin.storage : supabase.storage;
      const dataClient = usedAdminClient ? supabaseAdmin : supabase;

      const { error: uploadError } = await storageClient
        .from("bukti-ajuan")
        .upload(filePath, arrayBuffer, {
          contentType: selectedMimeType,
          upsert: true,
        });

      if (uploadError) {
        await dataClient.from("pengajuan").delete().eq("id", insertedData.id);
        throw uploadError;
      }

      Alert.alert("Berhasil mengajukan!");
      setKeterangan("");
      setSelectedImageUri("");
      setSelectedMimeType("image/jpeg");
      setAlreadySubmitted(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Izin kamera ditolak");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.6,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setSelectedImageUri(result.assets[0].uri);
    setSelectedMimeType(result.assets[0].mimeType || "image/jpeg");
  };

  if (loadingUser) return <ActivityIndicator size="large" style={{ flex: 1 }} color="#6D3BFF" />;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Formulir izin</Text>
            <Text style={styles.title}>Ajukan Izin</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Ajukan izin atau sakit dengan keterangan jelas</Text>
          <Text style={styles.infoText}>Permintaan akan diteruskan ke admin untuk ditinjau pada hari yang sama.</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>Nama</Text>
          <Text style={styles.userValue}>{user?.nama}</Text>
          <Text style={[styles.userLabel, { marginTop: 12 }]}>Kelas</Text>
          <Text style={styles.userValue}>{user?.kelas}</Text>
        </View>

        <Text style={styles.label}>Pilih Jenis</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.jenisButton, jenis === "izin" && styles.jenisSelected]}
            onPress={() => setJenis("izin")}
            disabled={alreadySubmitted}
          >
            <Text style={[styles.jenisText, jenis === "izin" && styles.jenisTextSelected]}>Izin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.jenisButton, jenis === "sakit" && styles.jenisSelected]}
            onPress={() => setJenis("sakit")}
            disabled={alreadySubmitted}
          >
            <Text style={[styles.jenisText, jenis === "sakit" && styles.jenisTextSelected]}>Sakit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Keterangan</Text>
        <TextInput
          placeholder="Tulis alasan atau catatan untuk sekolah"
          style={styles.input}
          value={keterangan}
          onChangeText={setKeterangan}
          multiline
          editable={!alreadySubmitted}
          placeholderTextColor="#A89F9F"
        />

        <Text style={styles.label}>Bukti Foto</Text>
        <TouchableOpacity
          style={[styles.photoPicker, alreadySubmitted && styles.submitDisabled]}
          onPress={pickImage}
          disabled={alreadySubmitted}
        >
          <Ionicons name="image-outline" size={18} color="#16324f" />
          <Text style={styles.photoPickerText}>
            {selectedImageUri ? "Ambil Ulang Foto Bukti" : "Ambil Foto Bukti"}
          </Text>
        </TouchableOpacity>

        {selectedImageUri ? (
          <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, (submitting || alreadySubmitted) && styles.submitDisabled]}
          onPress={submitAjuan}
          disabled={submitting || alreadySubmitted}
        >
          <Text style={styles.submitText}>
            {alreadySubmitted ? "Sudah Mengajukan Hari Ini" : submitting ? "Mengirim..." : "Kirim Permintaan Izin"}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
      <UserBottomNav activeKey="ajuan" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  shell: {
    paddingBottom: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#dbe7f4",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextWrap: { marginLeft: 12 },
  eyebrow: { color: "#6d7e90", fontSize: 12, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: "#11263c" },
  infoCard: { backgroundColor: "#16324f", borderRadius: 24, padding: 16, marginBottom: 16 },
  infoTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  infoText: { marginTop: 6, color: "#c7d8e9", fontSize: 12, lineHeight: 18 },
  userInfo: { marginBottom: 20, padding: 18, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e2eaf2" },
  userLabel: { color: "#6d7e90", fontSize: 12, marginBottom: 4 },
  userValue: { fontSize: 18, fontWeight: "700", color: "#11263c" },
  label: { fontSize: 14, marginBottom: 10, fontWeight: "700", color: "#5B5050" },
  buttonRow: { flexDirection: "row", marginBottom: 15 },
  jenisButton: {
    flex: 1,
    paddingVertical: 14,
    marginHorizontal: 5,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  jenisSelected: { backgroundColor: "#16324f", borderColor: "#16324f" },
  jenisText: { fontSize: 16, color: "#555" },
  jenisTextSelected: { color: "#fff", fontWeight: "bold" },
  input: {
    borderWidth: 1,
    borderColor: "#e2eaf2",
    borderRadius: 20,
    padding: 15,
    backgroundColor: "#fff",
    marginBottom: 20,
    textAlignVertical: "top",
    minHeight: 140,
    color: "#11263c",
  },
  photoPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#dbe7f4",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  photoPickerText: {
    color: "#16324f",
    fontWeight: "700",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  submitButton: {
    backgroundColor: "#16324f",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: "#aaa" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
