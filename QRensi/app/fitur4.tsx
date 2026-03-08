import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Fitur4() {

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusColor, setStatusColor] = useState("");

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={80} color="#4C6EF5" />
        <Text style={styles.permissionText}>Akses kamera diperlukan</Text>

        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = async ({ data }: any) => {

    setScanned(true);

    const uid = data;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      setStatusText("User tidak ditemukan");
      setStatusColor("#FA5252");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: cek } = await supabase
      .from("absensi")
      .select("*")
      .eq("user_id", uid)
      .eq("tanggal", today)
      .single();

    if (cek) {
      setStatusText(profile.nama + " sudah hadir hari ini");
      setStatusColor("#FAB005");
      return;
    }

    const { error } = await supabase
      .from("absensi")
      .insert({
        user_id: uid,
        nama: profile.nama,
        kelas: profile.kelas,
        tanggal: today,
        status: "hadir"
      });

    if (error) {
      setStatusText("Gagal menyimpan absensi");
      setStatusColor("#FA5252");
    } else {
      setStatusText(profile.nama + " berhasil absen");
      setStatusColor("#40C057");
    }
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>

        <Text style={styles.title}>Scan QR Absensi</Text>
      </View>

      {/* CAMERA */}

      <View style={styles.cameraContainer}>

        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"]
          }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />

        {/* FRAME SCAN */}

        <View style={styles.scanFrame} />

      </View>

      {/* STATUS */}

      {statusText !== "" && (
        <View style={[styles.statusBox, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      )}

      {/* BUTTON */}

      {scanned && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setScanned(false);
            setStatusText("");
          }}
        >
          <Text style={styles.buttonText}>Scan Lagi</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#F8F9FE"
},

header:{
flexDirection:"row",
alignItems:"center",
padding:20
},

title:{
fontSize:18,
fontWeight:"bold",
marginLeft:10
},

cameraContainer:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

camera:{
width:"100%",
height:"100%"
},

scanFrame:{
position:"absolute",
width:250,
height:250,
borderWidth:3,
borderColor:"#4C6EF5",
borderRadius:20
},

statusBox:{
padding:15,
margin:20,
borderRadius:12,
alignItems:"center"
},

statusText:{
color:"#fff",
fontWeight:"bold",
fontSize:16
},

button:{
backgroundColor:"#4C6EF5",
padding:15,
marginHorizontal:20,
marginBottom:30,
borderRadius:12,
alignItems:"center"
},

buttonText:{
color:"#fff",
fontWeight:"bold"
},

center:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

permissionText:{
fontSize:16,
marginVertical:20
}

});