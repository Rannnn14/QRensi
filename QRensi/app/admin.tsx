import { View, Text, Button } from "react-native"
import { supabase } from "../lib/supabase"
import { router } from "expo-router"

export default function Admin() {
  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
      <Text>HALAMAN ADMIN</Text>
      <Button title="Logout" onPress={logout}/>
    </View>
  )
}