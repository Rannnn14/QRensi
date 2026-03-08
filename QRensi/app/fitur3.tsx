import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"

export default function Fitur3() {

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

  const today = new Date().toISOString().split("T")[0]

  const loadData = useCallback(async () => {

    const { data:profileData } = await supabase
      .from("profiles")
      .select("*")

    const { data:absenData } = await supabase
      .from("absensi")
      .select("*")
      .eq("tanggal",today)

    setProfiles(profileData || [])
    setAbsensi(absenData || [])

  },[today])

  useEffect(()=>{
    loadData()
  },[loadData])

  const updateStatus = async (uid:string,status:string) => {

    const user = profiles.find(u => u.id === uid)

    const existing = absensi.find(
      a => a.user_id === uid && a.tanggal === today
    )

    if(existing){

      await supabase
        .from("absensi")
        .update({ status })
        .eq("user_id",uid)
        .eq("tanggal",today)

    } else {

      await supabase
        .from("absensi")
        .insert({
          user_id:uid,
          nama:user.nama,
          kelas:user.kelas,
          tanggal:today,
          status
        })

    }

    loadData()

  }

  const getStatus = (uid:string) => {

    const data = absensi.find(a => a.user_id === uid)

    return data?.status || "belum"

  }

  if(!selectedKelas){

    return(

      <View style={styles.container}>

        <Text style={styles.title}>Absensi Manual</Text>

        <FlatList
          data={kelasList}
          keyExtractor={(item)=>item}
          numColumns={2}
          renderItem={({item})=>(
            <TouchableOpacity
              style={styles.card}
              onPress={()=>setSelectedKelas(item)}
            >

              <Text style={styles.cardText}>{item}</Text>

            </TouchableOpacity>
          )}
        />

      </View>

    )

  }

  const siswa = profiles.filter(p => p.kelas === selectedKelas)

  return(

    <View style={styles.container}>

      <TouchableOpacity onPress={()=>setSelectedKelas(null)}>
        <Text style={styles.back}>← Kembali</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Kelas {selectedKelas}</Text>

      <FlatList
        data={siswa}
        keyExtractor={(item)=>item.id}
        renderItem={({item})=>{

          const status = getStatus(item.id)

          return(

            <View style={styles.row}>

              <Text style={styles.nama}>{item.nama}</Text>

              <View style={styles.buttonRow}>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    status==="hadir" && styles.hadir
                  ]}
                  onPress={()=>updateStatus(item.id,"hadir")}
                >
                  <Text style={styles.btnText}>Hadir</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    status==="izin" && styles.izin
                  ]}
                  onPress={()=>updateStatus(item.id,"izin")}
                >
                  <Text style={styles.btnText}>Izin</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    status==="sakit" && styles.sakit
                  ]}
                  onPress={()=>updateStatus(item.id,"sakit")}
                >
                  <Text style={styles.btnText}>Sakit</Text>
                </TouchableOpacity>

              </View>

            </View>

          )

        }}
      />

    </View>

  )

}

const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:"#F4F6FA",
    padding:20
  },

  title:{
    fontSize:26,
    fontWeight:"bold",
    marginBottom:20
  },

  card:{
    flex:1,
    backgroundColor:"#4A6CF7",
    margin:10,
    padding:35,
    borderRadius:15,
    alignItems:"center",
    elevation:3
  },

  cardText:{
    color:"#fff",
    fontSize:20,
    fontWeight:"bold"
  },

  back:{
    fontSize:18,
    marginBottom:10
  },

  row:{
    backgroundColor:"#fff",
    padding:15,
    borderRadius:10,
    marginBottom:12,
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
    paddingVertical:8,
    paddingHorizontal:14,
    borderRadius:8,
    backgroundColor:"#ccc"
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