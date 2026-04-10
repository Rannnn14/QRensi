import { 
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from "react-native"

import { useState, useCallback } from "react"
import { supabaseAdmin } from "../../lib/supabaseAdmin"
import { router } from "expo-router"
import { Picker } from "@react-native-picker/picker"
import { Ionicons } from '@expo/vector-icons'

export default function TambahUser(){

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [nama,setNama] = useState("")
  const [kelas,setKelas] = useState("7 Banin")
  const [loading,setLoading] = useState(false)
  const [showPassword,setShowPassword] = useState(false)
  const [refreshing,setRefreshing] = useState(false)

  // Auto-uppercase saat mengetik nama
  const handleNamaChange = (text:string) => setNama(text.toUpperCase())

  // Validasi format email sederhana
  const isValidEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }

  const createUser = async () => {
    if(!email || !password || !nama || !kelas){
      Alert.alert("Error","Semua kolom harus diisi")
      return
    }

    if(!isValidEmail(email)){
      Alert.alert("Error","Format email tidak valid")
      return
    }

    // Popup konfirmasi sebelum membuat user
    Alert.alert(
      "Konfirmasi",
      `Apakah Anda yakin ingin membuat user ${nama.toUpperCase()} dengan email ${email}?`,
      [
        { text:"Batal", style:"cancel" },
        { 
          text:"Iya", 
          onPress: async () => {
            setLoading(true)
            const namaUppercase = nama.toUpperCase()

            try {
              // Membuat user via Supabase Admin
              const { data: authData, error: authError } =
                await supabaseAdmin.auth.admin.createUser({
                  email,
                  password,
                  email_confirm: true,
                  user_metadata:{
                    full_name:namaUppercase,
                    class_name:kelas
                  }
                })

              let userId = authData?.user?.id

              if(authError && !authError.message.includes("already registered")){
                throw new Error(authError.message)
              }

              if(userId){
                const { error: profileError } =
                  await supabaseAdmin.from("profiles").upsert({
                    id:userId,
                    role:"user",
                    nama:namaUppercase,
                    kelas:kelas
                  })

                if(profileError){
                  throw new Error(profileError.message)
                }
              }

              Alert.alert("Berhasil",`Data ${namaUppercase} berhasil dibuat!`)

              // Reset form
              setEmail("")
              setPassword("")
              setNama("")
              setKelas("7 Banin")
            } catch(err:any){
              Alert.alert("Error", err.message || "Terjadi kesalahan")
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    // Bisa tambahkan fetch dari server jika diperlukan
    // tapi form tetap utuh, input tidak hilang
    setTimeout(() => setRefreshing(false), 1000)
  }, [])

  return(
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>
      }
    >

      <View style={styles.header}>
        <TouchableOpacity onPress={()=>router.back()}>
          <Ionicons name="arrow-back" size={28} color="#3A86FF" />
        </TouchableOpacity>

        <Text style={styles.title}>Tambah User</Text>
      </View>

      <TextInput
        placeholder="Nama Lengkap"
        value={nama}
        onChangeText={handleNamaChange}
        style={styles.input}
        autoCapitalize="characters"
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
      />

      {/* Password dengan toggle mata */}
      <View style={styles.passwordBox}>
        <TextInput
          placeholder="Password"
          value={password}
          secureTextEntry={!showPassword}
          onChangeText={setPassword}
          style={styles.passwordInput}
        />
        <TouchableOpacity onPress={()=>setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.pickerBox}>
        <Picker
          selectedValue={kelas}
          onValueChange={(v)=>setKelas(v)}
        >
          <Picker.Item label="7 Banin" value="7 Banin"/>
          <Picker.Item label="7 Banat" value="7 Banat"/>
          <Picker.Item label="8 Banin" value="8 Banin"/>
          <Picker.Item label="8 Banat" value="8 Banat"/>
          <Picker.Item label="9 Banin" value="9 Banin"/>
          <Picker.Item label="9 Banat" value="9 Banat"/>
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={createUser}
      >
        <Text style={styles.buttonText}>
          {loading ? "Membuat..." : "Buat User"}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:{
    flexGrow:1,
    padding:20,
    backgroundColor:"#F1F4F9"
  },
  header:{
    flexDirection:"row",
    alignItems:"center",
    marginBottom:25
  },
  title:{
    fontSize:22,
    fontWeight:"bold",
    marginLeft:15,
    color:"#3A86FF"
  },
  input:{
    backgroundColor:"#fff",
    padding:15,
    borderRadius:12,
    marginBottom:15,
    fontWeight:"600",
    fontSize:16,
    shadowColor:"#000",
    shadowOpacity:0.05,
    shadowRadius:5,
    shadowOffset:{width:0,height:2},
    elevation:2
  },
  passwordBox:{
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"#fff",
    paddingHorizontal:15,
    borderRadius:12,
    marginBottom:15,
    shadowColor:"#000",
    shadowOpacity:0.05,
    shadowRadius:5,
    shadowOffset:{width:0,height:2},
    elevation:2
  },
  passwordInput:{
    flex:1,
    paddingVertical:15,
    fontWeight:"600",
    fontSize:16
  },
  pickerBox:{
    backgroundColor:"#fff",
    borderRadius:12,
    marginBottom:20,
    overflow:"hidden",
    shadowColor:"#000",
    shadowOpacity:0.05,
    shadowRadius:5,
    shadowOffset:{width:0,height:2},
    elevation:2
  },
  button:{
    backgroundColor:"#3A86FF",
    padding:18,
    borderRadius:12,
    alignItems:"center",
    marginTop:10,
    shadowColor:"#3A86FF",
    shadowOpacity:0.3,
    shadowRadius:8,
    shadowOffset:{width:0,height:3},
    elevation:5
  },
  buttonText:{
    color:"#fff",
    fontWeight:"bold",
    fontSize:16
  }
})
