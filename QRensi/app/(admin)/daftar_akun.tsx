import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState, useCallback } from "react"
import { Picker } from "@react-native-picker/picker"
import { supabase } from "../../lib/supabase"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import {
  compareStudentNames,
  isStudentNameVerySimilar,
  matchesStudentSearch,
  normalizeStudentName,
} from "../../lib/student"

type Profile = {
  id: string
  nama: string
  kelas: string
  role?: string
}

export default function DaftarAkun() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editNama, setEditNama] = useState("")
  const [editKelas, setEditKelas] = useState("7 Banin")
  const [searchQuery, setSearchQuery] = useState("")
  const [processingAction, setProcessingAction] = useState<"edit" | "delete" | "reset" | null>(null)
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (editModalVisible) {
        closeEditModal()
        return true
      }

      return false
    },
  })

  const classes = ["7 Banin", "7 Banat", "8 Banin", "8 Banat", "9 Banin", "9 Banat"]

  const getProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "user")
      .order("nama", { ascending: true })

    if (error) {
      console.log(error)
    }

    if (data) {
      setProfiles(
        [...data].sort((a, b) => compareStudentNames(a.nama, b.nama))
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let realtimeChannel: any

    const setupRealtime = async () => {
      await getProfiles()
      realtimeChannel = supabase
        .channel("public:profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          getProfiles()
        })
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    }
  }, [getProfiles])

  const siswa = profiles
    .filter((user) => user.kelas === selectedClass)
    .filter((user) => !searchQuery.trim() || matchesStudentSearch(user.nama || "", searchQuery))
    .sort((a, b) => compareStudentNames(a.nama, b.nama))

  const onRefresh = async () => {
    setRefreshing(true)
    await getProfiles()
    setRefreshing(false)
  }

  const openEditModal = (user: Profile) => {
    setEditingUser(user)
    setEditNama(normalizeStudentName(user.nama))
    setEditKelas(user.kelas)
    setEditModalVisible(true)
  }

  const closeEditModal = () => {
    setEditModalVisible(false)
    setEditingUser(null)
    setEditNama("")
    setEditKelas("7 Banin")
  }

  const getExactDuplicateUser = (namaValue: string, excludeId?: string) => {
    const normalized = normalizeStudentName(namaValue)
    return profiles.find(
      (item) => item.id !== excludeId && normalizeStudentName(item.nama || "") === normalized
    )
  }

  const getSimilarDuplicateUser = (namaValue: string, excludeId?: string) => {
    const normalized = normalizeStudentName(namaValue)
    return profiles.find(
      (item) =>
        item.id !== excludeId &&
        normalizeStudentName(item.nama || "") !== normalized &&
        isStudentNameVerySimilar(item.nama || "", normalized)
    )
  }

  const saveUserUpdate = async (skipDuplicateWarning = false) => {
    if (!editingUser) return

    const namaBaru = normalizeStudentName(editNama)
    if (!namaBaru || !editKelas) {
      Alert.alert("Error", "Nama dan kelas wajib diisi")
      return
    }

    const exactDuplicate = getExactDuplicateUser(namaBaru, editingUser.id)
    const similarDuplicate = getSimilarDuplicateUser(namaBaru, editingUser.id)

    if (exactDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Sudah Terdaftar",
        `${namaBaru} sudah terdaftar. Apakah ingin tetap melanjutkan edit data?`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => saveUserUpdate(true) },
        ]
      )
      return
    }

    if (similarDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Mirip Terdeteksi",
        `Nama ${namaBaru} sangat mirip dengan ${normalizeStudentName(
          similarDuplicate.nama || ""
        )}. Periksa lagi agar tidak tertukar.`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => saveUserUpdate(true) },
        ]
      )
      return
    }

    try {
      setProcessingAction("edit")

      await supabaseAdmin
        .from("profiles")
        .update({ nama: namaBaru, kelas: editKelas })
        .eq("id", editingUser.id)
        .throwOnError()

      const syncResults = await Promise.allSettled([
        (async () => {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(editingUser.id, {
            user_metadata: {
              full_name: namaBaru,
              class_name: editKelas,
            },
          })

          if (error) {
            throw error
          }
        })(),
        supabaseAdmin
          .from("absensi")
          .update({ nama: namaBaru, kelas: editKelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
        supabaseAdmin
          .from("pengajuan")
          .update({ nama: namaBaru, kelas: editKelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
      ])

      setProfiles((prev) =>
        prev
          .map((item) =>
            item.id === editingUser.id ? { ...item, nama: namaBaru, kelas: editKelas } : item
          )
          .sort((a, b) => compareStudentNames(a.nama, b.nama))
      )

      if (selectedClass === editingUser.kelas && editKelas !== editingUser.kelas) {
        setSelectedClass(editKelas)
      }

      closeEditModal()
      const hasSyncWarning = syncResults.some((result) => result.status === "rejected")

      if (hasSyncWarning) {
        Alert.alert(
          "Berhasil Sebagian",
          "Profil siswa berhasil diperbarui, tetapi ada data lama yang belum tersinkron penuh."
        )
      } else {
        Alert.alert("Berhasil", "Data siswa berhasil diperbarui.")
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Gagal memperbarui data siswa")
    } finally {
      setProcessingAction(null)
    }
  }

  const deleteUser = (user: Profile) => {
    Alert.alert(
      "Hapus Siswa",
      `Hapus ${user.nama} dari sistem? Data profil, absensi, pengajuan, dan akun login akan ikut terhapus.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction("delete")

              const { error: pengajuanError } = await supabaseAdmin
                .from("pengajuan")
                .delete()
                .eq("user_id", user.id)
              if (pengajuanError) throw pengajuanError

              const { error: absensiError } = await supabaseAdmin
                .from("absensi")
                .delete()
                .eq("user_id", user.id)
              if (absensiError) throw absensiError

              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .delete()
                .eq("id", user.id)
              if (profileError) throw profileError

              const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
              if (authError) throw authError

              setProfiles((prev) => prev.filter((item) => item.id !== user.id))
              Alert.alert("Berhasil", `${user.nama} berhasil dihapus.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal menghapus siswa")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
  }

  const resetClassUsers = () => {
    if (!selectedClass) return

    const usersInClass = profiles.filter((item) => item.kelas === selectedClass)
    if (!usersInClass.length) {
      Alert.alert("Info", `Belum ada siswa di kelas ${selectedClass}.`)
      return
    }

    Alert.alert(
      "Reset Per Kelas",
      `Hapus semua siswa kelas ${selectedClass} beserta absensi, pengajuan, dan akun loginnya?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingAction("reset")
              const userIds = usersInClass.map((item) => item.id)

              const { error: pengajuanError } = await supabaseAdmin
                .from("pengajuan")
                .delete()
                .in("user_id", userIds)
              if (pengajuanError) throw pengajuanError

              const { error: absensiError } = await supabaseAdmin
                .from("absensi")
                .delete()
                .in("user_id", userIds)
              if (absensiError) throw absensiError

              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .delete()
                .in("id", userIds)
              if (profileError) throw profileError

              for (const userId of userIds) {
                const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
                if (authError) {
                  throw authError
                }
              }

              setProfiles((prev) => prev.filter((item) => item.kelas !== selectedClass))
              Alert.alert("Berhasil", `Semua akun siswa kelas ${selectedClass} berhasil direset.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal reset data kelas")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Direktori akun</Text>
            <Text style={styles.title}>Daftar Akun Siswa</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Pilih kelas untuk melihat akun aktif</Text>
          <Text style={styles.infoText}>
            Data akan diperbarui otomatis saat ada perubahan profil siswa.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#6D3BFF" />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View style={styles.grid}>
              {classes.map((kelas) => {
                const jumlah = profiles.filter((user) => user.kelas === kelas).length
                const active = selectedClass === kelas
                return (
                  <TouchableOpacity
                    key={kelas}
                    style={[styles.card, active && styles.cardActive]}
                    onPress={() => setSelectedClass(kelas)}
                  >
                    <Ionicons name="school" size={26} color={active ? "#6D3BFF" : "#3A86FF"} />
                    <Text style={styles.kelasText}>{kelas}</Text>
                    <Text style={styles.jumlah}>{jumlah} siswa</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {selectedClass && (
              <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                  <View>
                    <Text style={styles.listTitle}>Siswa {selectedClass}</Text>
                    <Text style={styles.listCount}>{siswa.length} siswa terdaftar</Text>
                    <Text style={styles.listHint}>Edit nama/kelas, hapus siswa, atau reset satu kelas penuh.</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.resetButton, processingAction === "reset" && styles.disabledButton]}
                    onPress={resetClassUsers}
                    disabled={processingAction !== null}
                  >
                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                    <Text style={styles.resetButtonText}>
                      {processingAction === "reset" ? "Reset..." : "Reset Kelas"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color="#6d7e90" />
                  <TextInput
                    placeholder="Cari nama siswa"
                    placeholderTextColor="#A89F9F"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#6d7e90" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {siswa.length === 0 ? (
                  <Text style={styles.kosong}>
                    {searchQuery ? "Nama siswa tidak ditemukan" : "Belum ada akun"}
                  </Text>
                ) : (
                  siswa.map((user) => (
                    <View key={user.id} style={styles.userItem}>
                      <View style={styles.userInfo}>
                        <Ionicons name="person-circle" size={24} color="#6D3BFF" />
                        <View style={styles.userTextWrap}>
                          <Text style={styles.nama}>{user.nama}</Text>
                          <Text style={styles.kelasBadge}>{user.kelas}</Text>
                        </View>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => openEditModal(user)}
                          disabled={processingAction !== null}
                        >
                          <Ionicons name="create-outline" size={16} color="#16324f" />
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => deleteUser(user)}
                          disabled={processingAction !== null}
                        >
                          <Ionicons name="trash-outline" size={16} color="#fff" />
                          <Text style={styles.deleteButtonText}>Hapus</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <Modal transparent animationType="fade" visible={editModalVisible} onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Edit siswa</Text>
                <Text style={styles.modalTitle}>{editingUser?.nama || "-"}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeEditModal}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Nama siswa"
              placeholderTextColor="#A89F9F"
              value={editNama}
              onChangeText={(text) => setEditNama(normalizeStudentName(text))}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />

            <View style={styles.pickerBox}>
              <Picker selectedValue={editKelas} onValueChange={(value) => setEditKelas(value)}>
                {classes.map((kelas) => (
                  <Picker.Item key={kelas} label={kelas} value={kelas} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, processingAction === "edit" && styles.disabledButton]}
              onPress={() => saveUserUpdate()}
              disabled={processingAction === "edit"}
            >
              <Text style={styles.saveButtonText}>
                {processingAction === "edit" ? "Menyimpan..." : "Simpan Perubahan"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminBottomNav activeKey="daftar_akun" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f7fb" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
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
  title: { fontSize: 24, fontWeight: "800", color: "#11263c" },
  infoCard: {
    backgroundColor: "#16324f",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
  },
  infoTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  infoText: { marginTop: 6, color: "#c7d8e9", fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  cardActive: { backgroundColor: "#dbe7f4", borderWidth: 1, borderColor: "#16324f" },
  kelasText: { fontSize: 15, fontWeight: "bold", marginTop: 8, color: "#11263c" },
  jumlah: { fontSize: 12, color: "#6d7e90", marginTop: 3 },
  listContainer: {
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2eaf2",
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#e2eaf2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: "#11263c",
    fontSize: 14,
    fontWeight: "600",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  listTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4, color: "#11263c" },
  listCount: { color: "#16324f", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  listHint: { color: "#6d7e90", fontSize: 12, lineHeight: 18, maxWidth: 220 },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  userItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef3f8",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userTextWrap: { marginLeft: 10, flex: 1 },
  nama: { fontSize: 15, color: "#11263c", fontWeight: "700" },
  kelasBadge: { color: "#6d7e90", marginTop: 4, fontSize: 12 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dbe7f4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editButtonText: { color: "#16324f", fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  deleteButtonText: { color: "#fff", fontWeight: "700" },
  kosong: { color: "#6d7e90", fontStyle: "italic" },
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalEyebrow: { color: "#6d7e90", fontSize: 12, marginBottom: 4 },
  modalTitle: { color: "#11263c", fontSize: 20, fontWeight: "800" },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#dbe7f4",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 18,
    marginBottom: 15,
    fontWeight: "600",
    fontSize: 16,
    color: "#11263c",
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  pickerBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2eaf2",
    overflow: "hidden",
  },
  saveButton: {
    backgroundColor: "#16324f",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabledButton: { opacity: 0.7 },
})
