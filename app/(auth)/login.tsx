import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { AppTheme } from "../../constants/theme";
import { AppButton } from "../../components/ui/app-button";
import { AppInput } from "../../components/ui/app-input";
import { AppCard } from "../../components/ui/app-card";

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
        <View style={styles.headerContainer}>
          <View style={styles.logoWrapper}>
            <Image 
              source={require("../../assets/images/react-logo.png")} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>QRensi</Text>
          </View>
          
          <View style={styles.waveDecorator} />
        </View>

        <AppCard style={styles.formContainer}>
          <Text style={styles.welcomeEyebrow}>Secure school attendance</Text>
          <Text style={styles.welcomeText}>Masuk ke panel QRensi</Text>
          <Text style={styles.welcomeCaption}>
            Gunakan akun yang sudah terdaftar untuk mengakses dashboard admin atau siswa.
          </Text>

          <AppInput
            placeholder="Email"
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <AppInput
            placeholder="Password"
            secureTextEntry={!isPasswordVisible}
            onChangeText={setPassword}
            trailingIcon={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            onTrailingPress={() => setIsPasswordVisible(!isPasswordVisible)}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <AppButton label="Login" onPress={handleLogin} />
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  headerContainer: {
    height: 320,
    backgroundColor: AppTheme.colors.accent,
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
    color: AppTheme.colors.white,
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
    backgroundColor: AppTheme.colors.background,
    borderTopLeftRadius: 100,
    transform: [{ scaleX: 1.5 }],
  },
  formContainer: {
    marginHorizontal: 20,
    marginTop: -28,
    gap: AppTheme.spacing.md,
  },
  welcomeEyebrow: {
    ...AppTheme.typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  welcomeText: {
    ...AppTheme.typography.title,
  },
  welcomeCaption: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
    marginBottom: AppTheme.spacing.sm,
  },
  errorText: {
    color: AppTheme.colors.danger,
    textAlign: "left",
    fontSize: 13,
  }
});
