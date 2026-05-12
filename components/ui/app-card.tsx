import { StyleSheet, View, type ViewProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = ViewProps & {
  tone?: "default" | "hero" | "soft";
};

export function AppCard({ style, tone = "default", ...props }: Props) {
  return (
    <View
      style={[
        styles.base,
        tone === "hero" ? styles.hero : undefined,
        tone === "soft" ? styles.soft : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: AppTheme.spacing.lg,
    ...AppTheme.shadow.sm,
  },
  hero: {
    backgroundColor: AppTheme.colors.primary,
    borderColor: AppTheme.colors.primary,
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.xl,
  },
  soft: {
    backgroundColor: AppTheme.colors.surfaceMuted,
  },
});
