import { useEffect, useRef } from "react"
import { router } from "expo-router"
import { StyleSheet, View } from "react-native"
import { AppTheme } from "../constants/theme"
import { ensureProfileForUser } from "../lib/auth"
import { supabase } from "../lib/supabase"

export default function Index() {
  const navigatingRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const resolveRoute = async () => {
      if (navigatingRef.current || !isMounted) {
        return
      }

      navigatingRef.current = true

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const sessionUser = sessionData.session?.user

        if (!sessionUser) {
          router.replace("/login")
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        const safeUser = userData.user || sessionUser

        if (!safeUser) {
          router.replace("/login")
          return
        }

        if (userError) {
          console.log("Validasi sesi memakai data lokal:", userError.message)
        }

        const profile = await ensureProfileForUser(safeUser)

        if (!profile) {
          router.replace("/login")
          return
        }

        router.replace(profile.role === "admin" ? "/admin" : "/user")
      } catch (error) {
        console.log("Gagal memulihkan sesi:", error)
        router.replace("/login")
      } finally {
        navigatingRef.current = false
      }
    }

    resolveRoute()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        resolveRoute().catch(() => undefined)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <View style={styles.screen} />
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
})
