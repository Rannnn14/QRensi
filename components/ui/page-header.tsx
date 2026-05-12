import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = {
  title: string;
  eyebrow?: string;
  onBackPress?: () => void;
  rightSlot?: ReactNode;
};

export function PageHeader({ title, eyebrow, onBackPress, rightSlot }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBackPress || (() => (router.canGoBack() ? router.back() : null))}
      >
        <Ionicons name="arrow-back" size={18} color={AppTheme.colors.primary} />
      </TouchableOpacity>

      <View style={styles.textWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>

      {rightSlot ? <View>{rightSlot}</View> : <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.md,
    padding: AppTheme.spacing.sm,
    borderRadius: AppTheme.radius.xl,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    ...AppTheme.shadow.sm,
    marginBottom: AppTheme.spacing.xl,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
  },
  textWrap: {
    flex: 1,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.surfaceMuted,
  },
  eyebrow: {
    ...AppTheme.typography.eyebrow,
    marginBottom: AppTheme.spacing.xs,
    color: AppTheme.colors.primary,
    fontWeight: "700",
  },
  title: {
    ...AppTheme.typography.titleSm,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  placeholder: {
    width: 44,
    height: 44,
  },
});
