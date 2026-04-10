import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  BackHandler,
  Alert
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"

export default function Daftar_hadir() {

  const kelasList = [
    "7 Banin",
    "7 Banat",
    "8 Banin",
    "8 Banat",
    "9 Banin",
    "9 Banat"
  ]

  const [profiles,setProfiles] = useState<any[]>([])
  const [absensi,setAbsensi] = useState<any[]>([])
  const [selectedKelas,setSelectedKelas] = useState<string | null>(null)
  const [refreshing,setRefreshing] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  // Load data awal
  const loadData = useCallback(async () => {
    const { data:profileData } = await supabase.from("profiles").select("*")
    const { data:absenData } = await supabase.from("absensi").select("*").eq("tanggal",today)

    setProfiles(profileData || [])
    setAbsensi(absenData || [])
  }, [today])

  useEffect(()=>{
    loadData()

    // --- REALTIME SUBSCRIPTION ---
    const profileSub = supabase
      .channel("profiles_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadData()
      })
      .subscribe()

    const absensiSub = supabase
      .channel("absensi_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(profileSub)
      supabase.removeChannel(absensiSub)
    }
  }, [loadData])

  // Toggle status absensi dengan konfirmasi popup
  const toggleStatus = async (uid:string,status:string) => {
    const user = profiles.find(u => u.id === uid)
    const existing = absensi.find(a => a.user_id === uid && a.tanggal === today)
    if(!user) return

    // Konfirmasi popup
    Alert.alert(
      "Konfirmasi Absensi",
      existing && existing.status === status
        ? `Apakah Anda ingin menghapus status "${status}" untuk ${user.nama}?`
        : `Apakah Anda yakin ingin mengubah status ke "${status}" untuk ${user.nama}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Iya",
          onPress: async () => {
            try {
              if(existing){
                if(existing.status === status){
                  // klik dua kali → hapus status
                  await supabase.from("absensi")
                    .update({ status: null })
                    .eq("user_id",uid)
                    .eq("tanggal",today)

                  setAbsensi(prev => prev.map(a => a.user_id===uid ? {...a,status:null} : a))
                } else {
                  // update status baru
                  await supabase.from("absensi")
                    .update({ status })
                    .eq("user_id",uid)
                    .eq("tanggal",today)

                  setAbsensi(prev => prev.map(a => a.user_id===uid ? {...a,status} : a))
                }
              } else {
                // insert baru
                const { data:newData } = await supabase.from("absensi").insert({
                  user_id:uid,
                  nama:user.nama,
                  kelas:user.kelas,
                  tanggal:today,
                  status
                }).select().single()

                if(newData) setAbsensi(prev => [...prev,newData])
              }
            } catch(err){
              console.log(err)
            }
          }
        }
      ]
    )
  }

  const getStatus = (uid:string) => {
    const data = absensi.find(a => a.user_id === uid)
    return data?.status || null
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // BackHandler tanpa popup
  useEffect(()=>{
    const backAction = () => {
      if(selectedKelas){
        setSelectedKelas(null)
        return true
      } else {
        router.replace("/admin")
        return true
      }
    }

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction)
    return () => backHandler.remove()
  }, [selectedKelas])

  // Daftar kelas
  if(!selectedKelas){
    return(
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/> }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>router.replace("/admin")}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Absensi Manual</Text>
        </View>

        <View style={styles.grid}>
          {kelasList.map(item => (
            <TouchableOpacity
              key={item}
              style={styles.card}
              onPress={()=>setSelectedKelas(item)}
            >
              <Text style={styles.cardText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    )
  }

  // Detail kelas
  const siswa = profiles.filter(p => p.kelas === selectedKelas)

  return(
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/> }
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={()=>setSelectedKelas(null)}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelas {selectedKelas}</Text>
      </View>

      {siswa.map(item => {
        const status = getStatus(item.id)
        return(
          <View key={item.id} style={styles.row}>
            <Text style={styles.nama}>{item.nama}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn,status==="hadir" && styles.hadir]}
                onPress={()=>toggleStatus(item.id,"hadir")}
              >
                <Text style={styles.btnText}>Hadir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn,status==="izin" && styles.izin]}
                onPress={()=>toggleStatus(item.id,"izin")}
              >
                <Text style={styles.btnText}>Izin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn,status==="sakit" && styles.sakit]}
                onPress={()=>toggleStatus(item.id,"sakit")}
              >
                <Text style={styles.btnText}>Sakit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:{
    flexGrow:1,
    backgroundColor:"#F4F6FA",
    padding:15
  },
  header:{
    flexDirection:"row",
    alignItems:"center",
    backgroundColor:"#3A86FF",
    padding:15,
    borderRadius:12,
    marginBottom:20
  },
  headerTitle:{
    color:"#fff",
    fontSize:22,
    fontWeight:"bold",
    marginLeft:15
  },
  grid:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-between"
  },
  card:{
    flexBasis:"48%",
    backgroundColor:"#4A6CF7",
    marginBottom:15,
    paddingVertical:40,
    borderRadius:20,
    alignItems:"center",
    shadowColor:"#000",
    shadowOpacity:0.15,
    shadowRadius:8,
    shadowOffset:{width:0,height:4},
    elevation:5
  },
  cardText:{
    color:"#fff",
    fontSize:20,
    fontWeight:"bold"
  },
  row:{
    backgroundColor:"#fff",
    padding:15,
    borderRadius:12,
    marginBottom:12,
    shadowColor:"#000",
    shadowOpacity:0.05,
    shadowRadius:5,
    shadowOffset:{width:0,height:2},
    elevation:2
  },
  nama:{
    fontSize:18,
    fontWeight:"600",
    marginBottom:10
  },
  buttonRow:{
    flexDirection:"row",
    justifyContent:"space-between"
  },
  btn:{
    flex:1,
    paddingVertical:10,
    marginHorizontal:3,
    borderRadius:10,
    backgroundColor:"#ccc",
    alignItems:"center"
  },
  hadir:{
    backgroundColor:"#22C55E"
  },
  izin:{
    backgroundColor:"#FACC15"
  },
  sakit:{
    backgroundColor:"#EF4444"
  },
  btnText:{
    color:"#fff",
    fontWeight:"bold"
  }
})
