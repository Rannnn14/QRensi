import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AppTheme } from "../constants/theme"

const items = [
  { key: "daftar_akun", label: "Akun", icon: "people-outline", route: "/daftar_akun" },
  { key: "daftar_hadir", label: "Hadir", icon: "clipboard-outline", route: "/daftar_hadir" },
  { key: "admin", label: "Home", icon: "home", route: "/admin" },
  { key: "pengajuan", label: "Ajuan", icon: "document-text-outline", route: "/pengajuan" },
  { key: "scanner", label: "Scan", icon: "scan-outline", route: "/scanner" },
]

type Props = {
  activeKey: string
}

export function AdminBottomNav({ activeKey }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
        const active = item.key === activeKey
        const isHome = item.key === "admin"

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            onPress={() => router.replace(item.route as any)}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive, isHome && active && styles.homeIconWrap]}>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={isHome && active ? "#FFFFFF" : active ? "#16324f" : "#7e8e9e"}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive, isHome && active && styles.homeLabelActive]}>{item.label}</Text>
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
    paddingHorizontal: AppTheme.spacing.xs,
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
  homeIconWrap: {
    backgroundColor: AppTheme.colors.primary,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: AppTheme.colors.textSoft,
  },
  labelActive: {
    color: AppTheme.colors.primary,
  },
  homeLabelActive: {
    color: AppTheme.colors.primary,
    fontWeight: "800",
  },
})
