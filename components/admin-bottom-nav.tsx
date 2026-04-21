import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AppTheme } from "../constants/theme"

const items = [
  { key: "admin", label: "Dasbor", icon: "grid-outline", route: "/admin" },
  { key: "daftar_akun", label: "Akun", icon: "people-outline", route: "/daftar_akun" },
  { key: "tambah_user", label: "Tambah", icon: "person-add-outline", route: "/tambah_user" },
  { key: "daftar_hadir", label: "Hadir", icon: "clipboard-outline", route: "/daftar_hadir" },
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
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: AppTheme.colors.textSoft,
  },
  labelActive: {
    color: AppTheme.colors.primary,
  },
})
