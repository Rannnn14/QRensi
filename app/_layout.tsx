import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { AppTheme } from "../constants/theme";
import { cleanupExpiredSubmissions } from "../lib/pengajuan";
import { supabase } from "../lib/supabase";

export default function Layout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(AppTheme.colors.background).catch(() => undefined);

    let cleanupInFlight = false;

    const runExpiredSubmissionCleanup = async () => {
      if (cleanupInFlight) {
        return;
      }

      cleanupInFlight = true;

      try {
        await cleanupExpiredSubmissions();
      } catch (error) {
        console.log("Gagal membersihkan pengajuan kedaluwarsa:", error);
      } finally {
        cleanupInFlight = false;
      }
    };

    const handleAppStateChange = (state: string) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        runExpiredSubmissionCleanup().catch(() => undefined);
        return;
      }

      supabase.auth.stopAutoRefresh();
    };

    runExpiredSubmissionCleanup().catch(() => undefined);
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
