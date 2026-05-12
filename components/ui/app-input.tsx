import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";

import { AppTheme } from "@/constants/theme";

type Props = TextInputProps & {
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onTrailingPress?: () => void;
};

export function AppInput({ style, trailingIcon, onTrailingPress, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        placeholderTextColor={AppTheme.colors.textSoft}
        style={[styles.input, trailingIcon ? styles.inputWithTrailing : undefined, style]}
        {...props}
      />
      {trailingIcon ? (
        <TouchableOpacity
          style={styles.trailingButton}
          onPress={onTrailingPress}
          hitSlop={10}
          activeOpacity={0.8}
        >
          <Ionicons name={trailingIcon} size={20} color={AppTheme.colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 56,
    justifyContent: "center",
    backgroundColor: AppTheme.colors.surface,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingLeft: AppTheme.spacing.lg,
    paddingRight: AppTheme.spacing.lg,
    overflow: "hidden",
    position: "relative",
  },
  input: {
    minHeight: 56,
    color: AppTheme.colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 14,
  },
  inputWithTrailing: {
    paddingRight: 56,
  },
  trailingButton: {
    position: "absolute",
    right: 10,
    top: 11,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
});
