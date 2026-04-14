import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native"
import { useState, useCallback } from "react"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { router } from "expo-router"
import { Picker } from "@react-native-picker/picker"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { AdminBottomNav } from "../../components/admin-bottom-nav"
import {
  isStudentNameVerySimilar,
  normalizeStudentName,
} from "../../lib/student"

export default function TambahUser() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nama, setNama] = useState("")
  const [kelas, setKelas] = useState("7 Banin")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleNamaChange = (text: string) => setNama(normalizeStudentName(text))

  const isValidEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(value)
  }

  const createUser = async () => {
    if (!email || !password || !nama || !kelas) {
      Alert.alert("Error", "Semua kolom harus diisi")
      return
    }

    if (!isValidEmail(email)) {
      Alert.alert("Error", "Format email tidak valid")
      return
    }

    const namaUppercase = normalizeStudentName(nama)

    const proceedCreateUser = async () => {
      setLoading(true)

      try {
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: namaUppercase,
              class_name: kelas,
            },
          })

        const userId = authData?.user?.id

        if (authError?.message.includes("already registered")) {
          throw new Error("Email sudah terdaftar")
        }

        if (authError) {
          throw new Error(authError.message)
        }

        if (userId) {
          const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
            id: userId,
            role: "user",
            nama: namaUppercase,
            kelas,
          })

          if (profileError) throw new Error(profileError.message)
        }

        Alert.alert("Berhasil", `Data ${namaUppercase} berhasil dibuat!`)
        setEmail("")
        setPassword("")
        setNama("")
        setKelas("7 Banin")
      } catch (err: any) {
        Alert.alert("Error", err.message || "Terjadi kesalahan")
      } finally {
        setLoading(false)
      }
    }

    const { data: existingUsers, error: duplicateError } = await supabaseAdmin
      .from("profiles")
      .select("id, nama")
      .eq("role", "user")

    if (duplicateError) {
      Alert.alert("Error", duplicateError.message || "Gagal memeriksa nama siswa")
      return
    }

    const exactDuplicate = existingUsers?.find(
      (item) => normalizeStudentName(item.nama || "") === namaUppercase
    )
    const similarDuplicate = existingUsers?.find(
      (item) =>
        normalizeStudentName(item.nama || "") !== namaUppercase &&
        isStudentNameVerySimilar(item.nama || "", namaUppercase)
    )

    const continueAfterWarning = async () => {
      if (exactDuplicate) {
        Alert.alert(
          "Nama Sudah Terdaftar",
          `${namaUppercase} sudah terdaftar. Apakah ingin tetap melanjutkan pembuatan user?`,
          [
            { text: "Batal", style: "cancel" },
            { text: "Lanjut", onPress: proceedCreateUser },
          ]
        )
        return
      }

      if (similarDuplicate) {
        Alert.alert(
          "Nama Mirip Terdeteksi",
          `Nama ${namaUppercase} sangat mirip dengan ${normalizeStudentName(
            similarDuplicate.nama || ""
          )}. Periksa lagi agar tidak membuat akun ganda.`,
          [
            { text: "Batal", style: "cancel" },
            { text: "Lanjut", onPress: proceedCreateUser },
          ]
        )
        return
      }

      await proceedCreateUser()
    }

    Alert.alert(
      "Konfirmasi",
      `Apakah Anda yakin ingin membuat user ${namaUppercase} dengan email ${email}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            await continueAfterWarning()
          },
        },
      ]
    )
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }, [])

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/admin" as any)}
          >
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Akun baru</Text>
            <Text style={styles.title}>Tambah User</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Form pembuatan akun siswa</Text>
          <Text style={styles.infoText}>
            Lengkapi data dasar akun agar siswa dapat login dan menggunakan QR absensi.
          </Text>
        </View>

        <TextInput
          placeholder="Nama Lengkap"
          placeholderTextColor="#A89F9F"
          value={nama}
          onChangeText={handleNamaChange}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor="#A89F9F"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
        />

        <View style={styles.passwordBox}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#A89F9F"
            value={password}
            secureTextEntry={!showPassword}
            onChangeText={setPassword}
            style={styles.passwordInput}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.pickerBox}>
          <Picker selectedValue={kelas} onValueChange={(v) => setKelas(v)}>
            <Picker.Item label="7 Banin" value="7 Banin" />
            <Picker.Item label="7 Banat" value="7 Banat" />
            <Picker.Item label="8 Banin" value="8 Banin" />
            <Picker.Item label="8 Banat" value="8 Banat" />
            <Picker.Item label="9 Banin" value="9 Banin" />
            <Picker.Item label="9 Banat" value="9 Banat" />
          </Picker>
        </View>

        <TouchableOpacity style={styles.button} onPress={createUser}>
          <Text style={styles.buttonText}>{loading ? "Membuat..." : "Buat User"}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
      <AdminBottomNav activeKey="tambah_user" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f7fb",
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
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
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#11263c",
  },
  infoCard: {
    backgroundColor: "#16324f",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  infoText: {
    marginTop: 6,
    color: "#c7d8e9",
    lineHeight: 18,
    fontSize: 12,
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
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    borderRadius: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 15,
    fontWeight: "600",
    fontSize: 16,
    color: "#11263c",
  },
  pickerBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2eaf2",
  },
  button: {
    backgroundColor: "#16324f",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
})
