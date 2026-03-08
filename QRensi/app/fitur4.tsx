import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

export default function Fitur4() {

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>

        <Text style={styles.title}>Fitur 4</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.text}>Halaman Fitur 4</Text>
        <Text style={styles.desc}>
          Biasanya dipakai untuk pengaturan aplikasi.
        </Text>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({

container:{
flex:1,
padding:20,
backgroundColor:"#F8F9FE"
},

header:{
flexDirection:"row",
alignItems:"center",
marginBottom:20
},

title:{
fontSize:18,
fontWeight:"bold",
marginLeft:10
},

content:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

text:{
fontSize:20,
fontWeight:"bold"
},

desc:{
marginTop:10,
color:"#666",
textAlign:"center"
}

})