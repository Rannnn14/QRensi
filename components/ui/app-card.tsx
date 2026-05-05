import { StyleSheet, View, type ViewProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = ViewProps & {
  tone?: "default" | "hero" | "soft" | "muted";
  variant?: "default" | "elevated" | "outlined";
};

export function AppCard({ style, tone = "default", variant = "default", ...props }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === "elevated" ? styles.elevated : undefined,
        variant === "outlined" ? styles.outlined : undefined,
        tone === "hero" ? styles.hero : undefined,
        tone === "soft" ? styles.soft : undefined,
        tone === "muted" ? styles.muted : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: AppTheme.spacing.lg,
    ...AppTheme.shadow.sm,
  },
  elevated: {
    borderColor: AppTheme.colors.primarySoft,
    ...AppTheme.shadow.md,
  },
  outlined: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderColor: AppTheme.colors.borderStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  hero: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.lg,
    ...AppTheme.shadow.md,
  },
  soft: {
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderColor: AppTheme.colors.primarySoft,
  },
  muted: {
    backgroundColor: AppTheme.colors.backgroundMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
});
