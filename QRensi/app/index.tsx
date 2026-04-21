import { useEffect } from "react"
import { View, Text } from "react-native"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"

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

    const userId = sessionData.session.user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

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
