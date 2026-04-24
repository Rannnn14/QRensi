import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { AppTheme } from "../constants/theme";
import { supabase } from "../lib/supabase";

export default function Layout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(AppTheme.colors.background).catch(() => undefined);

    const handleAppStateChange = (state: string) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        return;
      }

      supabase.auth.stopAutoRefresh();
    };

    handleAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <>
      <StatusBar
        style="auto"
        hidden={false}
        translucent={false}
        backgroundColor={AppTheme.colors.background}
      />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
