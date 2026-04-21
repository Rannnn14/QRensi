import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const AppPalette = {
  primary: "#16324F",
  primarySoft: "#DBE7F4",
  primaryMuted: "#284B70",
  accent: "#3A86FF",
  accentSoft: "#EAF2FB",
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FBFF",
  border: "#E2EAF2",
  borderStrong: "#C7D6E4",
  text: "#11263C",
  textMuted: "#6D7E90",
  textSoft: "#8CA0B3",
  success: "#1E8C5D",
  successSoft: "#DFF6EF",
  warning: "#C67A12",
  warningSoft: "#FFF0D9",
  danger: "#C04444",
  dangerSoft: "#FDE8E8",
  info: "#22405F",
  white: "#FFFFFF",
  overlay: "rgba(17, 38, 60, 0.45)",
  shadow: "#0B1A2A",
};

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const AppRadius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const AppTypography = {
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: AppPalette.textMuted,
  } satisfies TextStyle,
  bodySm: {
    fontSize: 12,
    lineHeight: 18,
    color: AppPalette.textMuted,
  } satisfies TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: AppPalette.text,
  } satisfies TextStyle,
  titleSm: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: AppPalette.text,
  } satisfies TextStyle,
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: AppPalette.text,
  } satisfies TextStyle,
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: AppPalette.text,
  } satisfies TextStyle,
};

export const AppShadow = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: AppPalette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) as ViewStyle,
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: AppPalette.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 22,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }) as ViewStyle,
} as const;

export const AppTheme = {
  colors: AppPalette,
  spacing: AppSpacing,
  radius: AppRadius,
  typography: AppTypography,
  shadow: AppShadow,
} as const;

export const AppSurface = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppPalette.background,
  },
  page: {
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.xl,
  },
  card: {
    backgroundColor: AppPalette.surface,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppPalette.border,
    padding: AppSpacing.lg,
  },
  cardElevated: {
    backgroundColor: AppPalette.surface,
    borderRadius: AppRadius.lg,
    borderWidth: 1,
    borderColor: AppPalette.border,
    padding: AppSpacing.lg,
    ...AppShadow.sm,
  },
  heroCard: {
    backgroundColor: AppPalette.primary,
    borderRadius: AppRadius.xl,
    padding: AppSpacing.xl,
  },
  input: {
    backgroundColor: AppPalette.surface,
    borderRadius: AppRadius.md,
    borderWidth: 1,
    borderColor: AppPalette.border,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: 14,
    color: AppPalette.text,
  },
});

export const Colors = {
  light: {
    text: AppPalette.text,
    background: AppPalette.surface,
    tint: AppPalette.accent,
    icon: AppPalette.textMuted,
    tabIconDefault: AppPalette.textSoft,
    tabIconSelected: AppPalette.primary,
  },
  dark: {
    text: AppPalette.text,
    background: AppPalette.surface,
    tint: AppPalette.accent,
    icon: AppPalette.textMuted,
    tabIconDefault: AppPalette.textSoft,
    tabIconSelected: AppPalette.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "Times New Roman",
    rounded: "System",
    mono: "Menlo",
  },
  android: {
    sans: "sans-serif",
    serif: "serif",
    rounded: "sans-serif-medium",
    mono: "monospace",
  },
  default: {
    sans: "sans-serif",
    serif: "serif",
    rounded: "sans-serif",
    mono: "monospace",
  },
  web: {
    sans: "'Avenir Next', 'Segoe UI', sans-serif",
    serif: "Georgia, serif",
    rounded: "'Avenir Next', 'Segoe UI', sans-serif",
    mono: "'SFMono-Regular', Consolas, monospace",
  },
});
