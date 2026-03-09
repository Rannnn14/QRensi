import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../lib/supabase";

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

    try {
      setSubmitting(true);

      const { error } = await supabase.from("pengajuan").insert([
        {
          user_id: user.id,
          nama: user.nama,
          kelas: user.kelas,
          jenis,
          keterangan,
          status: "pending",
        },
      ]);

      if (error) throw error;
      Alert.alert("Berhasil mengajukan!");
      setKeterangan("");
      setAlreadySubmitted(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajukan Izin / Sakit</Text>

      <View style={styles.userInfo}>
        <Text style={styles.userText}>Nama: {user?.nama}</Text>
        <Text style={styles.userText}>Kelas: {user?.kelas}</Text>
      </View>

      <Text style={styles.label}>Pilih Jenis:</Text>
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

      <TextInput
        placeholder="Keterangan"
        style={styles.input}
        value={keterangan}
        onChangeText={setKeterangan}
        multiline
        editable={!alreadySubmitted}
      />

      <TouchableOpacity
        style={[styles.submitButton, (submitting || alreadySubmitted) && styles.submitDisabled]}
        onPress={submitAjuan}
        disabled={submitting || alreadySubmitted}
      >
        <Text style={styles.submitText}>
          {alreadySubmitted ? "Sudah Mengajukan Hari Ini" : submitting ? "Mengirim..." : "Kirim"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: "#333" },
  userInfo: { marginBottom: 20, padding: 15, backgroundColor: "#fff", borderRadius: 10, elevation: 2 },
  userText: { fontSize: 16, marginBottom: 5 },
  label: { fontSize: 16, marginBottom: 10, fontWeight: "600" },
  buttonRow: { flexDirection: "row", marginBottom: 15 },
  jenisButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
  },
  jenisSelected: { backgroundColor: "#4CAF50" },
  jenisText: { fontSize: 16, color: "#555" },
  jenisTextSelected: { color: "#fff", fontWeight: "bold" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    backgroundColor: "#fff",
    marginBottom: 20,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#1E90FF",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  submitDisabled: { backgroundColor: "#aaa" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});