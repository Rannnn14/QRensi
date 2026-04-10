import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Dimensions,
  ScrollView,
  RefreshControl
} from "react-native"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

const { width } = Dimensions.get("window")

export default function User() {

  const [name,setName] = useState("User")
  const [refreshing,setRefreshing] = useState(false)

  useEffect(()=>{
    let channel: any = null

    const initUser = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if(user?.email){
        const username = user.email.split("@")[0]
        setName(username)
      }

      if(user){
        channel = supabase
          .channel("realtime-user-" + user.id)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
            (payload: { new?: { nama?: string } }) => {
              if(payload.new?.nama){
                setName(payload.new.nama)
              }
            }
          )
          .subscribe()
      }
    }

    initUser()

    return () => {
      if(channel) supabase.removeChannel(channel)
    }
  },[])

  const onRefresh = async () => {
    setRefreshing(true)
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if(user?.email){
      const username = user.email.split("@")[0]
      setName(username)
    }
    setRefreshing(false)
  }

  return(
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
    >

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.appName}>QRensi</Text>
            <Text style={styles.userName}>Halo, {name}</Text>
          </View>

          <TouchableOpacity onPress={async ()=>{
            await supabase.auth.signOut()
            router.replace("/login")
          }} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#FF4D4F"/>
          </TouchableOpacity>
        </View>
      </View>

      {/* MENU */}
      <View style={styles.menuGrid}>

        <MenuIcon
          title="Status Kehadiran"
          icon="checkmark-done"
          color="#3A86FF"
          onPress={()=>router.push("/status_kehadiran" as any)}
        />

        <MenuIcon
          title="Riwayat Kehadiran"
          icon="time"
          color="#8338EC"
          onPress={()=>router.push("/riwayat_kehadiran" as any)}
        />

        <MenuIcon
          title="Ajuan"
          icon="document-text"
          color="#06D6A0"
          onPress={()=>router.push("/ajuan" as any)}
        />

        <MenuIcon
          title="Generate QR"
          icon="qr-code"
          color="#FF6B6B"
          onPress={()=>router.push("/generate_qr" as any)}
        />

      </View>
    </ScrollView>
  )
}

const MenuIcon = ({title,icon,color,onPress}:any)=>( 
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.iconBox,{backgroundColor:color}]}>
      <Ionicons name={icon} size={26} color="#fff"/>
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
  </TouchableOpacity>
)

const styles = StyleSheet.create({
  container:{
    flexGrow:1,
    backgroundColor:"#F4F6FB",
    paddingBottom:20
  },
  header:{
    backgroundColor:"#3A86FF",
    paddingTop:60,
    paddingHorizontal:25,
    paddingBottom:35,
    borderBottomLeftRadius:30,
    borderBottomRightRadius:30
  },
  headerTop:{
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center"
  },
  appName:{
    color:"#fff",
    fontSize:22,
    fontWeight:"bold"
  },
  userName:{
    color:"#EAF2FF",
    fontSize:14,
    marginTop:3
  },
  logoutBtn:{
    width:42,
    height:42,
    backgroundColor:"#fff",
    borderRadius:21,
    justifyContent:"center",
    alignItems:"center"
  },
  menuGrid:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-between",
    padding:20,
    marginTop:20
  },
  menuItem:{
    backgroundColor:"#fff",
    width:(width-60)/2,
    height:130,
    borderRadius:18,
    padding:20,
    marginBottom:20,
    justifyContent:"center",
    alignItems:"center",
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
  }
})
