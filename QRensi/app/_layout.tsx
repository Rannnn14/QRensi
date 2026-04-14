import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";

export default function Layout() {
  useEffect(() => {
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
      <StatusBar style="dark" hidden={false} translucent={false} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
