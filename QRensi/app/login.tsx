import React, { useState } from "react";
import { 
  View, 
  TextInput, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        {/* BAGIAN HEADER DENGAN LOGO */}
        <View style={styles.headerContainer}>
          <View style={styles.logoWrapper}>
            {/* TEMPAT LOGO ANDA - Ganti path sesuai file Anda */}
            <Image 
              source={require("../assets/images/react-logo.png")} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>MOFINOW</Text>
          </View>
          
          {/* Efek Gelombang Putih di Bawah Biru */}
          <View style={styles.waveDecorator} />
        </View>

        {/* BAGIAN FORM */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>
            Welcome <Text style={{ fontWeight: '400', color: '#888' }}>back !</Text>
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#C7C7CD"
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor="#C7C7CD"
              secureTextEntry={!isPasswordVisible}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
              <Ionicons 
                name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color="#BDBCBC" 
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.rowBetween}>
            <View style={styles.rememberMe}>
              <View style={styles.checkbox} />
              <Text style={styles.subText}>Remember me</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.subText}>Forget password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerContainer: {
    height: 320,
    backgroundColor: "#3A86FF", // Warna biru utama
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
  },
  logoWrapper: {
    alignItems: 'center',
    zIndex: 2,
    marginTop: -20,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 5,
  },
  brandName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  waveDecorator: {
    position: 'absolute',
    bottom: -50,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#fff',
    borderTopLeftRadius: 100, // Membuat efek lengkungan/gelombang
    transform: [{ scaleX: 1.5 }],
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 35,
    backgroundColor: '#fff',
    paddingTop: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
    color: "#444",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 30,
    paddingHorizontal: 25,
    height: 60,
    marginBottom: 20,
    // Shadow halus untuk input
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  input: {
    fontSize: 16,
    color: "#333",
    height: '100%',
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  rememberMe: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#7B61FF",
    marginRight: 8,
  },
  subText: {
    fontSize: 13,
    color: "#999",
  },
  loginButton: {
    height: 55,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#7B61FF",
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#7B61FF",
    fontSize: 18,
    fontWeight: "600",
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 13,
  }
});