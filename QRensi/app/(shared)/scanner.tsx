import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminBottomNav } from "../../components/admin-bottom-nav";
import { useFeatureBack } from "../../hooks/use-feature-back";
import { getLocalDateValue } from "../../lib/date";

export default function Scanner() {

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusColor, setStatusColor] = useState("");
  const handleBack = useFeatureBack({ fallbackRoute: "/admin" });

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
        <Ionicons name="camera-outline" size={80} color="#4C6EF5" />
        <Text style={styles.permissionText}>Akses kamera diperlukan</Text>

        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
        </View>
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

    const today = getLocalDateValue();

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
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={18} color="#6D3BFF" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Pemindaian cepat</Text>
            <Text style={styles.title}>Scan QR Absensi</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Arahkan kamera ke kartu QR siswa</Text>
          <Text style={styles.infoText}>Sistem akan membaca kode dan langsung mencatat kehadiran bila data valid.</Text>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"]
            }}
            onBarcodeScanned={scanned ? undefined : handleScan}
          />
          <View style={styles.scanFrame} />
        </View>

        {statusText !== "" && (
          <View style={[styles.statusBox, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

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
      <AdminBottomNav activeKey="scanner" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
screen:{
flex:1,
backgroundColor:"#f4f7fb"
},
container:{
flex:1,
backgroundColor:"#f4f7fb",
paddingHorizontal:16,
paddingTop:12,
paddingBottom:16
},
header:{
flexDirection:"row",
alignItems:"center",
marginBottom:16
},
backButton:{
width:40,
height:40,
borderRadius:14,
backgroundColor:"#dbe7f4",
justifyContent:"center",
alignItems:"center"
},
headerTextWrap:{
marginLeft:12
},
eyebrow:{
fontSize:12,
color:"#6d7e90",
marginBottom:4
},
title:{
fontSize:24,
fontWeight:"800",
color:"#11263c"
},
infoCard:{
backgroundColor:"#16324f",
borderRadius:24,
padding:16,
marginBottom:16
},
infoTitle:{
color:"#ffffff",
fontSize:15,
fontWeight:"800"
},
infoText:{
marginTop:6,
color:"#c7d8e9",
fontSize:12,
lineHeight:18
},
cameraContainer:{
flex:1,
justifyContent:"center",
alignItems:"center",
overflow:"hidden",
borderRadius:26
},
camera:{
width:"100%",
height:"100%",
borderRadius:26
},
scanFrame:{
position:"absolute",
width:250,
height:250,
borderWidth:3,
borderColor:"#dbe7f4",
borderRadius:24
},
statusBox:{
padding:15,
marginTop:16,
borderRadius:16,
alignItems:"center"
},
statusText:{
color:"#fff",
fontWeight:"bold",
fontSize:16
},
button:{
backgroundColor:"#16324f",
padding:15,
marginTop:16,
borderRadius:16,
alignItems:"center"
},
buttonText:{
color:"#fff",
fontWeight:"bold"
},
permissionScreen:{
flex:1,
backgroundColor:"#0f1720",
padding:20,
justifyContent:"center"
},
permissionCard:{
backgroundColor:"#f4f7fb",
borderRadius:32,
padding:24,
alignItems:"center"
},
permissionText:{
fontSize:16,
marginVertical:20,
color:"#11263c"
}
});
