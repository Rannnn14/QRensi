import { useEffect } from "react"
import { View, Text } from "react-native"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"
import { ensureProfileForUser } from "../lib/auth"

export default function Index() {

  useEffect(() => {
    check()
  }, [])

  const check = async () => {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.replace("/login")
      return
    }

    const profile = await ensureProfileForUser(sessionData.session.user)

    if (!profile) {
      router.replace("/login")
      return
    }

    if (profile.role === "admin") {
      router.replace("/admin")
    } else {
      router.replace("/user")
    }
  }

  return (
    <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
      <Text>Loading...</Text>
    </View>
  )
}
