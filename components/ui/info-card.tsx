import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = ViewProps & {
  title: string;
  description?: string;
  tone?: "primary" | "surface";
  rightSlot?: ReactNode;
};

export function InfoCard({
  title,
  description,
  tone = "primary",
  rightSlot,
  style,
  ...props
}: Props) {
  const primary = tone === "primary";

  return (
    <View style={[styles.base, primary ? styles.primary : styles.surface, style]} {...props}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={[styles.title, primary ? styles.titlePrimary : styles.titleSurface]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, primary ? styles.descriptionPrimary : styles.descriptionSurface]}>
              {description}
            </Text>
          ) : null}
        </View>
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: AppTheme.radius.xl,
    padding: AppTheme.spacing.lg,
    marginBottom: AppTheme.spacing.lg,
    ...AppTheme.shadow.sm,
  },
  primary: {
    backgroundColor: AppTheme.colors.primary,
    borderWidth: 1,
    borderColor: AppTheme.colors.primaryMuted,
  },
  surface: {
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
  },
  titlePrimary: {
    color: AppTheme.colors.white,
  },
  titleSurface: {
    color: AppTheme.colors.text,
  },
  description: {
    marginTop: AppTheme.spacing.xs,
    fontSize: 12,
    lineHeight: 18,
  },
  descriptionPrimary: {
    color: AppTheme.colors.primarySoft,
  },
  descriptionSurface: {
    color: AppTheme.colors.textMuted,
  },
});
