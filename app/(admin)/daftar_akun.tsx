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
import { InfoCard } from "../../components/ui/info-card"
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

      if (selectedClass) {
        setSelectedClass(null)
        setSearchQuery("")
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

  const siswa = profiles
    .filter((user) => user.kelas === selectedClass)
    .filter((user) => !searchQuery.trim() || matchesStudentSearch(user.nama || "", searchQuery))
    .sort((a, b) => compareStudentNames(a.nama, b.nama))

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
        eyebrow={selectedClass ? "Daftar siswa" : "Direktori akun"}
        title={selectedClass ? `Kelas ${selectedClass}` : "Daftar Akun Siswa"}
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

      {!selectedClass ? (
        <InfoCard
          title="Pilih kelas untuk melihat akun aktif"
          description="Admin dapat melihat email masuk siswa, mengubah data siswa, dan mengganti kata sandi baru tanpa menampilkan kata sandi lama."
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!selectedClass ? (
          <View style={styles.grid}>
            {classes.map((kelas) => {
              const jumlah = profiles.filter((user) => user.kelas === kelas).length
              const [grade, group] = kelas.split(" ")
              return (
                <TouchableOpacity
                  key={kelas}
                  style={styles.card}
                  onPress={() => setSelectedClass(kelas)}
                >
                  <View style={styles.cardAccentShape} />
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardIconWrap}>
                      <Ionicons name="school-outline" size={19} color={AppTheme.colors.primary} />
                    </View>
                    <View style={styles.cardArrowWrap}>
                      <Ionicons name="chevron-forward" size={15} color={AppTheme.colors.primary} />
                    </View>
                  </View>
                  <View style={styles.cardClassWrap}>
                    <Text style={styles.cardEyebrow}>Kelas</Text>
                    <View style={styles.cardClassRow}>
                      <Text style={styles.cardGrade}>{grade}</Text>
                      <Text style={styles.cardGroup}>{group}</Text>
                    </View>
                  </View>
                  <View style={styles.cardCountPill}>
                    <Ionicons name="person-outline" size={13} color={AppTheme.colors.textMuted} />
                    <Text style={styles.jumlah}>{jumlah} siswa</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <View style={styles.listContainer}>
            <SectionHeader
              title={`Siswa ${selectedClass}`}
              hint={`${siswa.length} siswa terdaftar. Edit data, lihat email masuk, ganti kata sandi, hapus siswa, atau atur ulang satu kelas penuh.`}
              rightSlot={
                <TouchableOpacity
                  style={[styles.resetButton, processingAction === "reset" && styles.disabledButton]}
                  onPress={resetClassUsers}
                  disabled={processingAction !== null}
                >
                  <Ionicons name="refresh-outline" size={16} color="#fff" />
                  <Text style={styles.resetButtonText}>
                    {processingAction === "reset" ? "Mengatur ulang..." : "Atur Ulang Kelas"}
                  </Text>
                </TouchableOpacity>
              }
            />

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
                    <Ionicons name="person-circle" size={24} color={AppTheme.colors.primary} />
                    <View style={styles.userTextWrap}>
                      <Text style={styles.nama}>{user.nama}</Text>
                      <Text style={styles.kelasBadge}>{user.kelas}</Text>
                      <Text style={styles.emailText}>{user.email || "Email tidak tersedia"}</Text>
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEditModal(user)}
                      disabled={processingAction !== null}
                    >
                      <Ionicons name="create-outline" size={16} color="#16324f" />
                      <Text style={styles.editButtonText}>Kelola</Text>
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
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  card: {
    width: "48%",
    backgroundColor: AppTheme.colors.surface,
    padding: 14,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    minHeight: 152,
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    gap: 12,
    ...AppTheme.shadow.sm,
  },
  cardActive: {
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.primary,
  },
  cardAccentShape: {
    position: "absolute",
    right: -26,
    top: -24,
    width: 92,
    height: 76,
    borderRadius: 22,
    backgroundColor: AppTheme.colors.accentSoft,
    transform: [{ rotate: "-18deg" }],
  },
  cardAccentShapeActive: {
    backgroundColor: AppTheme.colors.primarySoft,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: AppTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconWrapActive: {
    borderWidth: 1,
    borderColor: AppTheme.colors.primary,
  },
  cardArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: AppTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  cardArrowWrapActive: {
    borderColor: AppTheme.colors.primary,
  },
  cardClassWrap: {
    zIndex: 1,
  },
  cardEyebrow: {
    color: AppTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  cardClassRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },
  cardGrade: {
    color: AppTheme.colors.text,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 36,
  },
  cardGroup: {
    color: AppTheme.colors.primary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  cardCountPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingHorizontal: 9,
    paddingVertical: 6,
    zIndex: 1,
  },
  cardCountPillActive: {
    backgroundColor: AppTheme.colors.primarySoft,
    borderColor: AppTheme.colors.primarySoft,
  },
  jumlah: { fontSize: 11, color: AppTheme.colors.textMuted, fontWeight: "800" },
  listContainer: {
    marginTop: 20,
    backgroundColor: AppTheme.colors.surface,
    padding: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: AppTheme.colors.text,
    fontSize: 14,
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
  userItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userTextWrap: { marginLeft: 10, flex: 1 },
  nama: { fontSize: 15, color: AppTheme.colors.text, fontWeight: "700" },
  kelasBadge: { color: AppTheme.colors.textMuted, marginTop: 4, fontSize: 12 },
  emailText: { color: AppTheme.colors.primaryMuted, marginTop: 4, fontSize: 12, fontWeight: "600" },
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
    backgroundColor: AppTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
  },
  editButtonText: { color: AppTheme.colors.primary, fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppTheme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
  },
  deleteButtonText: { color: AppTheme.colors.white, fontWeight: "700" },
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
