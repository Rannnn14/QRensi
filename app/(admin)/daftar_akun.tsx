import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import { useFeatureBack } from "../../hooks/use-feature-back"
import { AppTheme } from "../../constants/theme"
import { ModalCard } from "../../components/ui/modal-card"
import { PageHeader } from "../../components/ui/page-header"
import { ScreenShell } from "../../components/ui/screen-shell"
import { SectionHeader } from "../../components/ui/section-header"
import {
  compareStudentNames,
  isValidStudentNisn,
  isStudentNameVerySimilar,
  matchesStudentSearch,
  normalizeStudentName,
  normalizeStudentNisn,
} from "../../lib/student"
import {
  createStudentAccount,
  listAuthUserEmailsById,
  updateStudentAccount,
} from "../../lib/admin-user-management"

type Profile = {
  id: string
  nama: string
  kelas: string
  nisn?: string | null
  role?: string
  email?: string | null
}

export default function DaftarAkun() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createNama, setCreateNama] = useState("")
  const [createNisn, setCreateNisn] = useState("")
  const [createKelas, setCreateKelas] = useState("7 Banin")
  const [editNama, setEditNama] = useState("")
  const [editKelas, setEditKelas] = useState("7 Banin")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("")
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showEditPasswordConfirm, setShowEditPasswordConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({})
  const [processingAction, setProcessingAction] = useState<"create" | "edit" | "delete" | "reset" | null>(null)
  const handleBack = useFeatureBack({
    fallbackRoute: "/admin",
    beforeBack: () => {
      if (createModalVisible) {
        closeCreateModal()
        return true
      }

      if (editModalVisible) {
        closeEditModal()
        return true
      }

      return false
    },
  })

  const classes = ["7 Banin", "7 Banat", "8 Banin", "8 Banat", "9 Banin", "9 Banat"]

  const getProfiles = useCallback(async (refreshEmails = false) => {
    try {
      let nextEmailByUserId = emailByUserId
      if (refreshEmails || !Object.keys(emailByUserId).length) {
        const authUserMap = await listAuthUserEmailsById()
        nextEmailByUserId = Object.fromEntries(authUserMap.entries())
        setEmailByUserId(nextEmailByUserId)
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "user")
        .order("nama", { ascending: true })

      if (error) {
        throw error
      }

      if (data) {
        setProfiles(
          [...data]
            .map((item) => ({
              ...item,
              email: nextEmailByUserId[item.id] || "",
            }))
            .sort((a, b) => compareStudentNames(a.nama, b.nama))
        )
      }
    } catch (error) {
      console.log(error)
    }
  }, [emailByUserId])

  useEffect(() => {
    let realtimeChannel: any

    const setupRealtime = async () => {
      await getProfiles(true)
      realtimeChannel = supabase
        .channel("public:profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          getProfiles(false)
        })
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
    }
  }, [getProfiles])

  const selectedClassLabel = selectedClass || "Semua kelas"
  const classCounts = classes.map((kelas) => ({
    kelas,
    total: profiles.filter((user) => user.kelas === kelas).length,
  }))

  const filteredUsers = profiles
    .filter((user) => !selectedClass || user.kelas === selectedClass)
    .filter((user) => {
      const query = searchQuery.trim().toLowerCase()

      if (!query) return true

      return (
        matchesStudentSearch(user.nama || "", query) ||
        String(user.nisn || "").toLowerCase().includes(query) ||
        String(user.email || "").toLowerCase().includes(query) ||
        String(user.kelas || "").toLowerCase().includes(query)
      )
    })
    .sort((a, b) => compareStudentNames(a.nama, b.nama))

  const clearFilters = () => {
    setSelectedClass(null)
    setSearchQuery("")
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await getProfiles()
    setRefreshing(false)
  }

  const closeCreateModal = () => {
    setCreateModalVisible(false)
    setCreateEmail("")
    setCreatePassword("")
    setShowCreatePassword(false)
    setCreateNama("")
    setCreateNisn("")
    setCreateKelas(selectedClass || "7 Banin")
  }

  const openEditModal = (user: Profile) => {
    setEditingUser(user)
    setEditNama(normalizeStudentName(user.nama))
    setEditKelas(user.kelas)
    setEditEmail((user.email || "").trim().toLowerCase())
    setEditPassword("")
    setEditPasswordConfirm("")
    setShowEditPassword(false)
    setShowEditPasswordConfirm(false)
    setEditModalVisible(true)
  }

  const closeEditModal = () => {
    setEditModalVisible(false)
    setEditingUser(null)
    setEditNama("")
    setEditKelas("7 Banin")
    setEditEmail("")
    setEditPassword("")
    setEditPasswordConfirm("")
    setShowEditPassword(false)
    setShowEditPasswordConfirm(false)
  }

  const isValidEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(value)
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
    const emailBaru = editEmail.trim().toLowerCase()
    const passwordBaru = editPassword.trim()
    if (!namaBaru || !editKelas || !emailBaru) {
      Alert.alert("Error", "Nama, email, dan kelas wajib diisi")
      return
    }

    if (!isValidEmail(emailBaru)) {
      Alert.alert("Error", "Format email tidak valid")
      return
    }

    if (passwordBaru && passwordBaru.length < 6) {
      Alert.alert("Kesalahan", "Kata sandi baru minimal 6 karakter")
      return
    }

    if (passwordBaru && passwordBaru !== editPasswordConfirm.trim()) {
      Alert.alert("Error", "Konfirmasi password baru belum sama")
      return
    }

    if (!isValidStudentNisn(editingUser.nisn || "")) {
      Alert.alert("Error", "NISN harus terdiri dari 10 digit")
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

      const updatedAccount = await updateStudentAccount({
        userId: editingUser.id,
        currentEmail: editingUser.email,
        nextEmail: emailBaru,
        nextName: namaBaru,
        nextClass: editKelas,
        nisn: editingUser.nisn,
        nextPassword: passwordBaru || undefined,
      })

      const syncResults = await Promise.allSettled([
        supabaseAdmin
          .from("absensi")
          .update({ nama: updatedAccount.nama, kelas: updatedAccount.kelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
        supabaseAdmin
          .from("pengajuan")
          .update({ nama: updatedAccount.nama, kelas: updatedAccount.kelas })
          .eq("user_id", editingUser.id)
          .throwOnError(),
      ])

      setProfiles((prev) =>
        prev
          .map((item) =>
            item.id === editingUser.id
              ? {
                  ...item,
                  nama: updatedAccount.nama,
                  kelas: updatedAccount.kelas,
                  email: updatedAccount.email,
                }
              : item
          )
          .sort((a, b) => compareStudentNames(a.nama, b.nama))
      )
      setEmailByUserId((prev) => ({
        ...prev,
        [editingUser.id]: updatedAccount.email,
      }))

      if (selectedClass === editingUser.kelas && editKelas !== editingUser.kelas) {
        setSelectedClass(updatedAccount.kelas)
      }

      closeEditModal()
      const hasSyncWarning = syncResults.some((result) => result.status === "rejected")

      if (hasSyncWarning) {
        Alert.alert(
          "Berhasil Sebagian",
          passwordBaru
            ? "Data siswa tersimpan, tetapi ada sinkronisasi lanjutan yang belum sepenuhnya berhasil."
            : "Profil siswa berhasil diperbarui, tetapi ada data lama yang belum tersinkron penuh."
        )
      } else {
        Alert.alert(
          "Berhasil",
          passwordBaru
            ? "Data siswa dan password baru berhasil diperbarui."
            : "Data siswa berhasil diperbarui."
        )
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Gagal memperbarui data siswa")
    } finally {
      setProcessingAction(null)
    }
  }

  const createUser = async (skipDuplicateWarning = false) => {
    const namaBaru = normalizeStudentName(createNama)
    const nisnBaru = normalizeStudentNisn(createNisn)
    const emailBaru = createEmail.trim().toLowerCase()

    if (!emailBaru || !createPassword || !namaBaru || !nisnBaru || !createKelas) {
      Alert.alert("Error", "Semua kolom harus diisi")
      return
    }

    if (createPassword.trim().length < 6) {
      Alert.alert("Kesalahan", "Kata sandi minimal 6 karakter")
      return
    }

    if (!isValidStudentNisn(nisnBaru)) {
      Alert.alert("Error", "NISN harus terdiri dari 10 digit")
      return
    }

    if (!isValidEmail(emailBaru)) {
      Alert.alert("Error", "Format email tidak valid")
      return
    }

    const duplicateNisn = profiles.find(
      (item) => normalizeStudentNisn(item.nisn || "") === nisnBaru
    )
    const similarDuplicate = getSimilarDuplicateUser(namaBaru)

    if (duplicateNisn) {
      Alert.alert(
        "NISN Sudah Terdaftar",
        `NISN ${nisnBaru} sudah terdaftar pada akun ${normalizeStudentName(
          duplicateNisn.nama || ""
        )}.`
      )
      return
    }

    if (similarDuplicate && !skipDuplicateWarning) {
      Alert.alert(
        "Nama Mirip Terdeteksi",
        `Nama ${namaBaru} sangat mirip dengan ${normalizeStudentName(
          similarDuplicate.nama || ""
        )}. Periksa lagi agar tidak membuat akun ganda.`,
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjut", onPress: () => createUser(true) },
        ]
      )
      return
    }

    Alert.alert(
      "Tambah Akun",
      `Buat akun untuk ${namaBaru} dengan email ${emailBaru}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              setProcessingAction("create")
              const createdUser = await createStudentAccount({
                email: emailBaru,
                password: createPassword,
                nama: namaBaru,
                kelas: createKelas,
                nisn: nisnBaru,
              })

              setEmailByUserId((prev) => ({
                ...prev,
                [createdUser.id]: createdUser.email,
              }))
              await getProfiles(false)
              setSelectedClass(createKelas)
              closeCreateModal()
              Alert.alert("Berhasil", `Akun ${namaBaru} berhasil dibuat.`)
            } catch (error: any) {
              Alert.alert("Error", error.message || "Gagal membuat akun siswa")
            } finally {
              setProcessingAction(null)
            }
          },
        },
      ]
    )
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
    <ScreenShell viewProps={{ style: styles.container }} footer={<AdminBottomNav activeKey="daftar_akun" />}>
      <PageHeader
        eyebrow="Master data"
        title="Daftar Akun Siswa"
        onBackPress={handleBack}
        rightSlot={
          <TouchableOpacity
            style={styles.addHeaderButton}
            onPress={() => {
              setCreateKelas(selectedClass || "7 Banin")
              setCreateModalVisible(true)
            }}
            disabled={processingAction === "create"}
          >
            <Ionicons name="add-circle" size={24} color={AppTheme.colors.white} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.masterSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total akun</Text>
            <Text style={styles.summaryValue}>{profiles.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Data tampil</Text>
            <Text style={styles.summaryValue}>{filteredUsers.length}</Text>
          </View>
          <TouchableOpacity
            style={[styles.summaryAddButton, processingAction === "create" && styles.disabledButton]}
            onPress={() => {
              setCreateKelas(selectedClass || "7 Banin")
              setCreateModalVisible(true)
            }}
            disabled={processingAction === "create"}
          >
            <Ionicons name="add" size={18} color={AppTheme.colors.white} />
            <Text style={styles.summaryAddText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterPanel}>
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.filterTitle}>Filter data</Text>
              <Text style={styles.filterHint}>Kelas: {selectedClassLabel}</Text>
            </View>
            {(selectedClass || searchQuery) ? (
              <TouchableOpacity style={styles.clearFilterButton} onPress={clearFilters}>
                <Ionicons name="close-circle-outline" size={16} color={AppTheme.colors.primary} />
                <Text style={styles.clearFilterText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#6d7e90" />
            <TextInput
              placeholder="Cari nama, NISN, email, atau kelas"
              placeholderTextColor="#8ca0b3"
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

          <View style={styles.classFilterList}>
            <TouchableOpacity
              style={[styles.classChip, !selectedClass && styles.classChipActive]}
              onPress={() => setSelectedClass(null)}
            >
              <Text style={[styles.classChipText, !selectedClass && styles.classChipTextActive]}>
                Semua
              </Text>
              <Text style={[styles.classChipCount, !selectedClass && styles.classChipTextActive]}>
                {profiles.length}
              </Text>
            </TouchableOpacity>
            {classCounts.map((item) => {
              const isActive = selectedClass === item.kelas

              return (
                <TouchableOpacity
                  key={item.kelas}
                  style={[styles.classChip, isActive && styles.classChipActive]}
                  onPress={() => setSelectedClass(item.kelas)}
                >
                  <Text style={[styles.classChipText, isActive && styles.classChipTextActive]}>
                    {item.kelas}
                  </Text>
                  <Text style={[styles.classChipCount, isActive && styles.classChipTextActive]}>
                    {item.total}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.listContainer}>
          <SectionHeader
            title="Data akun"
            hint={`${filteredUsers.length} dari ${profiles.length} akun ditampilkan. Kelola email, kelas, kata sandi, atau hapus akun dari daftar ini.`}
            rightSlot={
              selectedClass ? (
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
              ) : null
            }
          />

          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadText, styles.numberColumn]}>No</Text>
            <Text style={[styles.tableHeadText, styles.studentColumn]}>Siswa</Text>
            <Text style={[styles.tableHeadText, styles.actionColumn]}>Aksi</Text>
          </View>

          {filteredUsers.length === 0 ? (
            <Text style={styles.kosong}>
              {searchQuery || selectedClass ? "Data akun tidak ditemukan" : "Belum ada akun siswa"}
            </Text>
          ) : (
            filteredUsers.map((user, index) => (
              <View key={user.id} style={styles.userItem}>
                <Text style={styles.rowNumber}>{index + 1}</Text>
                <View style={styles.userTextWrap}>
                  <View style={styles.userTitleRow}>
                    <Text style={styles.nama} numberOfLines={1}>{user.nama || "Nama belum tersedia"}</Text>
                    <Text style={styles.kelasBadge}>{user.kelas || "-"}</Text>
                  </View>
                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>NISN</Text>
                      <Text style={styles.metaValue}>{user.nisn || "-"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Email</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {user.email || "Email tidak tersedia"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.actionColumn}>
                  <TouchableOpacity
                    style={styles.iconActionButton}
                    onPress={() => openEditModal(user)}
                    disabled={processingAction !== null}
                  >
                    <Ionicons name="create-outline" size={17} color={AppTheme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconActionButton, styles.iconDeleteButton]}
                    onPress={() => deleteUser(user)}
                    disabled={processingAction !== null}
                  >
                    <Ionicons name="trash-outline" size={17} color={AppTheme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={createModalVisible} onRequestClose={closeCreateModal}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Tambah akun</Text>
                <Text style={styles.modalTitle}>Tambah Akun Siswa</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeCreateModal}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Nama siswa"
              placeholderTextColor="#A89F9F"
              value={createNama}
              onChangeText={(text) => setCreateNama(normalizeStudentName(text))}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
            />

            <TextInput
              placeholder="NISN"
              placeholderTextColor="#A89F9F"
              value={createNisn}
              onChangeText={(text) => setCreateNisn(normalizeStudentNisn(text))}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={10}
              autoCorrect={false}
              autoComplete="off"
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor="#A89F9F"
              value={createEmail}
              onChangeText={setCreateEmail}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <TextInput
              placeholder="Kata sandi"
              placeholderTextColor="#A89F9F"
              value={createPassword}
              onChangeText={setCreatePassword}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showCreatePassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowCreatePassword((prev) => !prev)}>
              <Ionicons
                name={showCreatePassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.passwordToggleText}>
                {showCreatePassword ? "Sembunyikan Kata Sandi" : "Lihat Kata Sandi"}
              </Text>
            </TouchableOpacity>

            <View style={styles.pickerBox}>
              <Picker selectedValue={createKelas} onValueChange={(value) => setCreateKelas(value)}>
                {classes.map((kelas) => (
                  <Picker.Item key={kelas} label={kelas} value={kelas} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, processingAction === "create" && styles.disabledButton]}
              onPress={() => createUser()}
              disabled={processingAction === "create"}
            >
              <Text style={styles.saveButtonText}>
                {processingAction === "create" ? "Membuat..." : "Tambah Akun"}
              </Text>
            </TouchableOpacity>
          </ModalCard>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={editModalVisible} onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <ModalCard>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Kelola akun siswa</Text>
                <Text style={styles.modalTitle}>{editingUser?.nama || "-"}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeEditModal}>
                <Ionicons name="close" size={18} color="#16324f" />
              </TouchableOpacity>
            </View>

            <View style={styles.accountInfoCard}>
              <Text style={styles.accountInfoLabel}>Email Masuk</Text>
                      <Text style={styles.accountInfoValue}>{editingUser?.email || "Email tidak tersedia"}</Text>
              <Text style={styles.accountInfoHint}>
                Kata sandi lama tidak ditampilkan. Isi kata sandi baru hanya jika admin ingin menggantinya.
              </Text>
            </View>

            <TextInput
              placeholder="Email masuk"
              placeholderTextColor="#A89F9F"
              value={editEmail}
              onChangeText={setEditEmail}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

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

            <TextInput
              placeholder="Kata sandi baru (opsional)"
              placeholderTextColor="#A89F9F"
              value={editPassword}
              onChangeText={setEditPassword}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showEditPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowEditPassword((prev) => !prev)}>
              <Ionicons
                name={showEditPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.passwordToggleText}>
                {showEditPassword ? "Sembunyikan Kata Sandi Baru" : "Lihat Kata Sandi Baru"}
              </Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Konfirmasi kata sandi baru"
              placeholderTextColor="#A89F9F"
              value={editPasswordConfirm}
              onChangeText={setEditPasswordConfirm}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showEditPasswordConfirm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowEditPasswordConfirm((prev) => !prev)}
            >
              <Ionicons
                name={showEditPasswordConfirm ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.passwordToggleText}>
                {showEditPasswordConfirm ? "Sembunyikan Konfirmasi" : "Lihat Konfirmasi"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, processingAction === "edit" && styles.disabledButton]}
              onPress={() => saveUserUpdate()}
              disabled={processingAction === "edit"}
            >
              <Text style={styles.saveButtonText}>
                {processingAction === "edit" ? "Menyimpan..." : "Simpan Perubahan"}
              </Text>
            </TouchableOpacity>
          </ModalCard>
        </View>
      </Modal>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 16 },
  addHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primary,
    shadowColor: AppTheme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  masterSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.lg,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
    ...AppTheme.shadow.sm,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: AppTheme.colors.primarySoft,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  summaryValue: {
    color: AppTheme.colors.white,
    fontSize: 21,
    fontWeight: "800",
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  summaryAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.accent,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryAddText: {
    color: AppTheme.colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  filterPanel: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  filterTitle: {
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  filterHint: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  clearFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clearFilterText: {
    color: AppTheme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  classFilterList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  classChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  classChipActive: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
  },
  classChipText: {
    color: AppTheme.colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  classChipCount: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  classChipTextActive: {
    color: AppTheme.colors.white,
  },
  listContainer: {
    backgroundColor: AppTheme.colors.surface,
    padding: 14,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    minHeight: 38,
    color: AppTheme.colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.danger,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetButtonText: { color: AppTheme.colors.white, fontWeight: "700", fontSize: 12 },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  tableHeadText: {
    color: AppTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  numberColumn: {
    width: 34,
  },
  studentColumn: {
    flex: 1,
  },
  actionColumn: {
    width: 74,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
    gap: 8,
  },
  rowNumber: {
    width: 30,
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  userTextWrap: { flex: 1, minWidth: 0 },
  userTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  nama: {
    flex: 1,
    fontSize: 13,
    color: AppTheme.colors.text,
    fontWeight: "800",
  },
  kelasBadge: {
    color: AppTheme.colors.primary,
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
  },
  metaGrid: {
    gap: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    width: 36,
    color: AppTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  metaValue: {
    flex: 1,
    color: AppTheme.colors.primaryMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  iconActionButton: {
    width: 32,
    height: 32,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  iconDeleteButton: {
    backgroundColor: "#FEE2E2",
  },
  kosong: { color: AppTheme.colors.textMuted, fontStyle: "italic" },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalEyebrow: { color: AppTheme.colors.textMuted, fontSize: 12, marginBottom: 4 },
  modalTitle: { color: AppTheme.colors.text, fontSize: 20, fontWeight: "800" },
  accountInfoCard: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderRadius: AppTheme.radius.md,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  accountInfoLabel: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "700",
  },
  accountInfoValue: {
    color: AppTheme.colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  accountInfoHint: {
    color: AppTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: AppTheme.colors.surface,
    padding: 15,
    borderRadius: AppTheme.radius.md,
    marginBottom: 15,
    fontWeight: "600",
    fontSize: 16,
    color: AppTheme.colors.text,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  passwordInput: {
    marginBottom: 8,
  },
  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 14,
  },
  passwordToggleText: {
    color: AppTheme.colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },
  pickerBox: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    overflow: "hidden",
  },
  saveButton: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { color: AppTheme.colors.white, fontWeight: "800", fontSize: 15 },
  disabledButton: { opacity: 0.7 },
})
