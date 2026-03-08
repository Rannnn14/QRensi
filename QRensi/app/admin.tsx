import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions
} from "react-native"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"
import { Ionicons } from '@expo/vector-icons'

const { width } = Dimensions.get("window")

export default function Admin() {

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
            <View style={styles.userInfo}>
                <Text style={styles.adminName}>Administrator</Text>
                <Text style={styles.adminRole}>Halaman Admin MOFINOW</Text>
            </View>

            <TouchableOpacity onPress={logout} style={styles.logoutCircle}>
                <Ionicons name="log-out-outline" size={24} color="#FF5252" />
            </TouchableOpacity>
        </View>

        <View style={styles.waveDecorator} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.menuGrid}>

          <MenuIcon
            title="Tambah User"
            icon="person-add"
            color="#4A90E2"
            onPress={() => router.push("/tambah_user")}
          />

          <MenuIcon
            title="Daftar Akun Siswa"
            icon="list"
            color="#7B61FF"
            onPress={() => router.push("/daftar_akun")}
          />

          <MenuIcon
            title="Fitur 3"
            icon="stats-chart"
            color="#FF9F43"
            onPress={() => router.push("/fitur3")}
          />

          <MenuIcon
            title="Fitur 4"
            icon="settings"
            color="#28C76F"
            onPress={() => router.push("/fitur4")}
          />

        </View>

      </ScrollView>
    </View>
  )
}

const MenuIcon = ({ title, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={30} color={color} />
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
  </TouchableOpacity>
)

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F8F9FE' },

  header: {
    height: 180,
    backgroundColor: '#3A86FF',
    paddingTop: 50,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  userInfo: { flex: 1 },

  adminName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },

  adminRole: { color: '#E0E0E0', fontSize: 14 },

  logoutCircle: {
    width: 45,
    height: 45,
    backgroundColor: '#fff',
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center'
  },

  waveDecorator: {
    position: 'absolute',
    bottom: -15,
    left: '10%',
    right: '10%',
    height: 30,
    backgroundColor: '#F8F9FE',
    borderRadius: 50
  },

  scrollContent: {
    padding: 20,
    paddingTop: 30
  },

  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },

  menuItem: {
    backgroundColor: '#fff',
    width: (width - 60) / 2,
    height: 150,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3
  },

  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15
  },

  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  }

})