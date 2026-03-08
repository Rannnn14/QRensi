import { Slot } from "expo-router"
import { View, StyleSheet } from "react-native"

export default function Layout() {
  return (
    <View style={styles.container}>
      <Slot /> {/* Ini akan render halaman child, misal fitur4.tsx */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" }
})