import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator
} from "react-native"

import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Daftar_akun(){

const [profiles,setProfiles] = useState<any[]>([])
const [loading,setLoading] = useState(true)
const [selectedClass,setSelectedClass] = useState<string | null>(null)

useEffect(()=>{
getProfiles()
},[])

const getProfiles = async () => {

const { data, error } = await supabase
.from("profiles")
.select("*")

if(error){
console.log(error)
}

if(data){
setProfiles(data)
}

setLoading(false)

}

const classes = [
"7 Banin",
"7 Banat",
"8 Banin",
"8 Banat",
"9 Banin",
"9 Banat"
]

const siswa = profiles.filter(
(user)=> user.kelas === selectedClass
)

return(

<View style={styles.container}>

<View style={styles.header}>

<TouchableOpacity onPress={()=>router.back()}>
<Ionicons name="arrow-back" size={24}/>
</TouchableOpacity>

<Text style={styles.title}>
Daftar Akun Siswa
</Text>

</View>

{loading ? (

<ActivityIndicator size="large"/>

) : (

<ScrollView showsVerticalScrollIndicator={false}>

{/* GRID KELAS */}

<View style={styles.grid}>

{classes.map((kelas)=>{

const jumlah = profiles.filter(
(user)=> user.kelas === kelas
).length

const active = selectedClass === kelas

return(

<TouchableOpacity
key={kelas}
style={[
styles.card,
active && styles.cardActive
]}
onPress={()=>setSelectedClass(kelas)}
>

<Ionicons name="school" size={26} color="#3A86FF"/>

<Text style={styles.kelasText}>
{kelas}
</Text>

<Text style={styles.jumlah}>
{jumlah} siswa
</Text>

</TouchableOpacity>

)

})}

</View>

{/* LIST SISWA */}

{selectedClass && (

<View style={styles.listContainer}>

<Text style={styles.listTitle}>
Siswa {selectedClass}
</Text>

{siswa.length === 0 ? (

<Text style={styles.kosong}>
Belum ada akun
</Text>

) : (

siswa.map((user)=>(
<View key={user.id} style={styles.userItem}>

<Ionicons name="person-circle" size={22} color="#3A86FF"/>

<Text style={styles.nama}>
{user.nama}
</Text>

</View>
))

)}

</View>

)}

</ScrollView>

)}

</View>

)

}

const styles = StyleSheet.create({

container:{
flex:1,
padding:20,
backgroundColor:"#F6F8FF"
},

header:{
flexDirection:"row",
alignItems:"center",
marginBottom:20
},

title:{
fontSize:20,
fontWeight:"bold",
marginLeft:10
},

grid:{
flexDirection:"row",
flexWrap:"wrap",
justifyContent:"space-between"
},

card:{
width:"48%",
backgroundColor:"#fff",
padding:18,
borderRadius:16,
alignItems:"center",
marginBottom:15,
elevation:3
},

cardActive:{
backgroundColor:"#E8F0FF",
borderWidth:1,
borderColor:"#3A86FF"
},

kelasText:{
fontSize:15,
fontWeight:"bold",
marginTop:8
},

jumlah:{
fontSize:12,
color:"#777",
marginTop:3
},

listContainer:{
marginTop:20,
backgroundColor:"#fff",
padding:16,
borderRadius:16,
elevation:2
},

listTitle:{
fontSize:17,
fontWeight:"bold",
marginBottom:12,
color:"#3A86FF"
},

userItem:{
flexDirection:"row",
alignItems:"center",
marginBottom:10,
paddingVertical:5
},

nama:{
marginLeft:10,
fontSize:15
},

kosong:{
color:"#888",
fontStyle:"italic"
}

})