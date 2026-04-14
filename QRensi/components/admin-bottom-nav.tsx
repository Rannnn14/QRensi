import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

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
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2eaf2",
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "#dbe7f4",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7e8e9e",
  },
  labelActive: {
    color: "#16324f",
  },
})
