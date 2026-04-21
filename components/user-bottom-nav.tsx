import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AppTheme } from "../constants/theme"

const items = [
  { key: "user", label: "Dasbor", icon: "home-outline", route: "/user" },
  { key: "status_kehadiran", label: "Status", icon: "checkmark-done-outline", route: "/status_kehadiran" },
  { key: "riwayat_kehadiran", label: "Riwayat", icon: "time-outline", route: "/riwayat_kehadiran" },
  { key: "ajuan", label: "Izin", icon: "document-text-outline", route: "/ajuan" },
  { key: "generate_qr", label: "Kode QR", icon: "qr-code-outline", route: "/generate_qr" },
]

type Props = {
  activeKey: string
}

export function UserBottomNav({ activeKey }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const active = item.key === activeKey

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => router.replace(item.route as any)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={active ? "#16324f" : "#7e8e9e"}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: AppTheme.spacing.sm,
    paddingTop: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: AppTheme.colors.border,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: AppTheme.colors.primarySoft,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: AppTheme.colors.textSoft,
  },
  labelActive: {
    color: AppTheme.colors.primary,
  },
})
