import { useEffect, useRef } from "react"
import { router } from "expo-router"
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native"
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

        if (userError || !safeUser) {
          await supabase.auth.signOut()
          router.replace("/login")
          return
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
    <View style={styles.screen}>
      <View style={styles.brandBadge}>
        <Image source={require("../assets/images/logo_qrensii.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandTitle}>Menyiapkan akses</Text>
      </View>
      <ActivityIndicator size="large" color={AppTheme.colors.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.background,
    gap: AppTheme.spacing.xl,
  },
  brandBadge: {
    alignItems: "center",
    gap: AppTheme.spacing.sm,
  },
  logo: {
    width: 116,
    height: 44,
  },
  brandTitle: {
    ...AppTheme.typography.titleSm,
    textAlign: "center",
  },
})
