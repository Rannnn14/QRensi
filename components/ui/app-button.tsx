import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View, type TouchableOpacityProps } from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = TouchableOpacityProps & {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
};

export function AppButton({ label, variant = "primary", icon, style, ...props }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.base,
        variant === "secondary" ? styles.secondary : undefined,
        variant === "danger" ? styles.danger : undefined,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={variant === "secondary" ? AppTheme.colors.primary : AppTheme.colors.white}
          />
        ) : null}
        <Text style={[styles.label, variant === "secondary" ? styles.labelSecondary : undefined]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AppTheme.spacing.lg,
  },
  secondary: {
    backgroundColor: AppTheme.colors.primarySoft,
  },
  danger: {
    backgroundColor: AppTheme.colors.danger,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AppTheme.spacing.sm,
  },
  label: {
    color: AppTheme.colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  labelSecondary: {
    color: AppTheme.colors.primary,
  },
});
