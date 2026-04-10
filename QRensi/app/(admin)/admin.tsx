import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  RefreshControl
} from "react-native"
import { router } from "expo-router"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"

const { width } = Dimensions.get("window")

export default function Admin() {

  const [refreshing, setRefreshing] = useState(false)

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  // --- FETCH DATA SUPABASE (REMAIN IN BACKGROUND) ---
  const fetchCounts = async () => {
    // Hanya untuk update internal (realtime listener), tidak ditampilkan
    await supabase.from("users").select("*", { count: "exact", head: true })
    await supabase.from("pengajuan").select("*", { count: "exact", head: true })
    await supabase.from("daftar_hadir").select("*", { count: "exact", head: true })
  }

  // --- REALTIME SUBSCRIPTIONS ---
  useEffect(() => {
    fetchCounts() // initial fetch

    const userSub = supabase
      .channel("public:users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        fetchCounts()
      })
      .subscribe()

    const submissionSub = supabase
      .channel("public:pengajuan")
      .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan" }, () => {
        fetchCounts()
      })
      .subscribe()

    const attendanceSub = supabase
      .channel("public:daftar_hadir")
      .on("postgres_changes", { event: "*", schema: "public", table: "daftar_hadir" }, () => {
        fetchCounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(userSub)
      supabase.removeChannel(submissionSub)
      supabase.removeChannel(attendanceSub)
    }
  }, [])

  // Fungsi refresh manual (pull-to-refresh)
  const onRefresh = async () => {
    setRefreshing(true)
    await fetchCounts()
    setRefreshing(false)
  }

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.appName}>QRensi</Text>
            <Text style={styles.adminRole}>Admin Dashboard</Text>
          </View>

          <TouchableOpacity onPress={logout} style={styles.logoutCircle}>
            <Ionicons name="log-out-outline" size={22} color="#FF4D4F"/>
          </TouchableOpacity>
        </View>

        <Text style={styles.welcomeText}>
          Kelola sistem absensi dengan mudah
        </Text>
      </View>

      {/* MENU */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.menuGrid}>
          <MenuIcon
            title="Tambah User"
            icon="person-add"
            color="#3A86FF"
            onPress={() => router.push("/tambah_user")}
          />

          <MenuIcon
            title="Daftar Akun"
            icon="people"
            color="#8338EC"
            onPress={() => router.push("/daftar_akun")}
          />

          <MenuIcon
            title="Daftar Hadir"
            icon="clipboard"
            color="#FB5607"
            onPress={() => router.push("/daftar_hadir" as any)}
          />

          <MenuIcon
            title="Pengajuan"
            icon="document-text"
            color="#06D6A0"
            onPress={() => router.push("/pengajuan" as any)}
          />
        </View>
      </ScrollView>

      {/* FLOATING SCANNER BUTTON */}
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push("/scanner" as any)}
      >
        <Ionicons name="qr-code" size={32} color="#fff"/>
      </TouchableOpacity>
    </View>
  )
}

const MenuIcon = ({ title, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.iconBox,{backgroundColor: color}]}>
      <Ionicons name={icon} size={26} color="#fff"/>
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:"#F1F4F9"
  },
  header:{
    backgroundColor:"#3A86FF",
    paddingTop:60,
    paddingHorizontal:25,
    paddingBottom:40,
    borderBottomLeftRadius:35,
    borderBottomRightRadius:35
  },
  headerContent:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center"
  },
  appName:{
    color:"#fff",
    fontSize:26,
    fontWeight:"bold",
    letterSpacing:1
  },
  adminRole:{
    color:"#E8F1FF",
    fontSize:14
  },
  welcomeText:{
    marginTop:15,
    color:"#EAF2FF",
    fontSize:13
  },
  logoutCircle:{
    width:42,
    height:42,
    backgroundColor:"#fff",
    borderRadius:21,
    justifyContent:"center",
    alignItems:"center"
  },
  scrollContent:{
    padding:22,
    paddingTop:30
  },
  menuGrid:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-between"
  },
  menuItem:{
    backgroundColor:"#fff",
    width:(width-60)/2,
    height:130,
    borderRadius:20,
    padding:20,
    marginBottom:20,
    justifyContent:"center",
    alignItems:"center",
    shadowColor:"#000",
    shadowOpacity:0.05,
    shadowRadius:10,
    shadowOffset:{width:0,height:4},
    elevation:3
  },
  iconBox:{
    width:55,
    height:55,
    borderRadius:16,
    justifyContent:"center",
    alignItems:"center",
    marginBottom:12
  },
  menuTitle:{
    fontSize:14,
    fontWeight:"600",
    color:"#333",
    textAlign:"center"
  },
  scanButton:{
    position:"absolute",
    bottom:30,
    alignSelf:"center",
    width:70,
    height:70,
    borderRadius:40,
    backgroundColor:"#3A86FF",
    justifyContent:"center",
    alignItems:"center",
    shadowColor:"#3A86FF",
    shadowOpacity:0.4,
    shadowRadius:10,
    shadowOffset:{width:0,height:4},
    elevation:8
  }
})
