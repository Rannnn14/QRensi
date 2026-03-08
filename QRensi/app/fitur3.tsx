import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Fitur3() {
  const [users, setUsers] = useState<any[]>([]);
  const [absen, setAbsen] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const today = new Date().toISOString().split("T")[0];
    const { data: absensi } = await supabase
      .from("absensi")
      .select("*")
      .eq("tanggal", today);

    setUsers(profiles || []);
    setAbsen(absensi || []);
  };

  const cekHadir = (uid: string) => absen.find(a => a.user_id === uid);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Daftar Absensi</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => {
          const hadir = cekHadir(item.id);
          return (
            <View style={styles.card}>
              <View>
                <Text style={styles.nama}>{item.nama}</Text>
                <Text style={styles.kelas}>{item.kelas}</Text>
              </View>
              <Text style={hadir ? styles.hadir : styles.belum}>
                {hadir ? "Hadir" : "Belum"}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F8F9FE" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginLeft: 10 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  nama: { fontSize: 16, fontWeight: "bold" },
  kelas: { fontSize: 13, color: "#666" },
  hadir: { color: "green", fontWeight: "bold" },
  belum: { color: "red", fontWeight: "bold" },
});