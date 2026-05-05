import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../constants/theme";
import { supabase } from "../lib/supabase";

export default function Index() {
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      router.replace("/login");
      return;
    }

    const userId = sessionData.session.user.id;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

    if (!profile) {
      router.replace("/login");
      return;
    }

    router.replace(profile.role === "admin" ? "/admin" : "/user");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.brandBadge}>
        <Image source={require("../assets/images/logo_qrensii.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandTitle}>Menyiapkan akses</Text>
      </View>
      <ActivityIndicator size="large" color={AppTheme.colors.primary} />
    </View>
  );
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
});
