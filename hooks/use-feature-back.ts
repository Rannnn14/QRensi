import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

type BackHandlerOptions = {
  fallbackRoute: string;
  beforeBack?: () => boolean;
};

export const useFeatureBack = ({ fallbackRoute, beforeBack }: BackHandlerOptions) => {
  const handleBack = useCallback(() => {
    if (beforeBack?.()) {
      return true;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }

    return true;
  }, [beforeBack, fallbackRoute]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);

      return () => subscription.remove();
    }, [handleBack])
  );

  return handleBack;
};
