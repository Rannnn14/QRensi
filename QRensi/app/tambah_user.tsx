import { 
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity
} from "react-native"

import { useState } from "react"
import { supabaseAdmin } from "../lib/supabaseAdmin"
import { router } from "expo-router"
import { Picker } from "@react-native-picker/picker"
import { Ionicons } from '@expo/vector-icons'

export default function TambahUser(){

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [nama,setNama] = useState("")
  const [kelas,setKelas] = useState("7 Banin")
  const [loading,setLoading] = useState(false)

  const createUser = async () => {

    if(!email || !password || !nama || !kelas){
      Alert.alert("Error","Semua kolom harus diisi")
      return
    }

    setLoading(true)

    const namaUppercase = nama.toUpperCase()

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
      setLoading(false)
      Alert.alert("Error Auth",authError.message)
      return
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
        setLoading(false)
        Alert.alert("Error Tabel Profiles",profileError.message)
        return
      }
    }

    setLoading(false)

    Alert.alert("Berhasil",`Data ${namaUppercase} berhasil diproses!`)

    setEmail("")
    setPassword("")
    setNama("")
    setKelas("7 Banin")
  }

  return(

    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={()=>router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>

        <Text style={styles.title}>Tambah User</Text>
      </View>

      <TextInput
        placeholder="NAMA LENGKAP"
        value={nama}
        onChangeText={setNama}
        style={styles.input}
      />

      <TextInput
        placeholder="EMAIL"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />

      <TextInput
        placeholder="PASSWORD"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
        style={styles.input}
      />

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

    </View>
  )
}

const styles = StyleSheet.create({

container:{flex:1,padding:20},

header:{
flexDirection:"row",
alignItems:"center",
marginBottom:20
},

title:{
fontSize:18,
fontWeight:"bold",
marginLeft:10
},

input:{
backgroundColor:"#f5f5f5",
padding:15,
borderRadius:10,
marginBottom:15
},

pickerBox:{
backgroundColor:"#f5f5f5",
borderRadius:10,
marginBottom:20
},

button:{
backgroundColor:"#7B61FF",
padding:15,
borderRadius:10,
alignItems:"center"
},

buttonText:{
color:"#fff",
fontWeight:"bold"
}

})