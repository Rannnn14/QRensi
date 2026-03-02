import { View, Text, Button, TextInput, Alert } from "react-native"
import { useState } from "react"
import { supabase } from "../lib/supabase"
import { supabaseAdmin } from "../lib/supabaseAdmin"
import { router } from "expo-router"

export default function Admin() {

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  const createUser = async () => {
    if(!email || !password){
      Alert.alert("Error","Isi email dan password")
      return
    }

    setLoading(true)

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    setLoading(false)

    if(error){
      Alert.alert("Error", error.message)
      return
    }

    Alert.alert("Berhasil","User berhasil dibuat")
    setEmail("")
    setPassword("")
  }

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>

      <Text style={{fontSize:20,fontWeight:"bold"}}>HALAMAN ADMIN</Text>

      <Button title="Logout" onPress={logout}/>

      <Text style={{marginTop:40,fontWeight:"bold"}}>Tambah User</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{borderWidth:1,width:220,padding:10,marginTop:10,borderRadius:6}}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{borderWidth:1,width:220,padding:10,marginTop:10,borderRadius:6}}
      />

      <View style={{marginTop:15}}>
        <Button
          title={loading ? "Membuat..." : "Buat User"}
          onPress={createUser}
        />
      </View>

    </View>
  )
}