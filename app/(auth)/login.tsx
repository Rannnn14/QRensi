import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { AppTheme } from "../../constants/theme";
import { AppButton } from "../../components/ui/app-button";
import { AppInput } from "../../components/ui/app-input";
import { AppCard } from "../../components/ui/app-card";
import { buildPasswordRequestNote } from "../../lib/pengajuan";

type AuthUserSummary = {
  id: string;
  email?: string;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

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

  const findAuthUserByEmail = async (targetEmail: string) => {
    let page = 1;
    const normalizedEmail = targetEmail.trim().toLowerCase();

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (error) {
        throw error;
      }

      const users = (data?.users || []) as AuthUserSummary[];
      const matchedUser = users.find((item) => (item.email || "").toLowerCase() === normalizedEmail);

      if (matchedUser) {
        return matchedUser;
      }

      if (users.length < 200) {
        return null;
      }

      page += 1;
    }
  };

  const submitForgotPassword = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail || !forgotPassword || !forgotPasswordConfirm || !forgotReason.trim()) {
      Alert.alert("Info", "Semua kolom permintaan password harus diisi.");
      return;
    }

    if (forgotPassword.length < 6) {
      Alert.alert("Info", "Password baru minimal 6 karakter.");
      return;
    }

    if (forgotPassword !== forgotPasswordConfirm) {
      Alert.alert("Info", "Konfirmasi password belum sama.");
      return;
    }

    try {
      setForgotSubmitting(true);

      const authUser = await findAuthUserByEmail(normalizedEmail);
      if (!authUser?.id) {
        throw new Error("Email akun tidak ditemukan.");
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, nama, kelas")
        .eq("id", authUser.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Profil pengguna tidak ditemukan.");
      }

      const { data: existingRequest, error: existingError } = await supabaseAdmin
        .from("pengajuan")
        .select("id")
        .eq("user_id", profile.id)
        .eq("jenis", "ganti_password")
        .eq("status", "pending")
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRequest?.id) {
        throw new Error("Permintaan ganti password masih menunggu persetujuan admin.");
      }

      const { error: insertError } = await supabaseAdmin.from("pengajuan").insert([
        {
          user_id: profile.id,
          nama: profile.nama,
          kelas: profile.kelas,
          jenis: "ganti_password",
          keterangan: buildPasswordRequestNote({
            password: forgotPassword,
            alasan: forgotReason.trim(),
            email: normalizedEmail,
          }),
          status: "pending",
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      Alert.alert("Berhasil", "Permintaan ganti password sudah dikirim ke admin.");
      setForgotEmail("");
      setForgotPassword("");
      setForgotPasswordConfirm("");
      setForgotReason("");
      setShowForgotPassword(false);
    } catch (requestError: any) {
      Alert.alert("Error", requestError.message || "Gagal mengirim permintaan ganti password.");
    } finally {
      setForgotSubmitting(false);
    }
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
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <AppInput
            placeholder="Password"
            value={password}
            secureTextEntry={!isPasswordVisible}
            onChangeText={setPassword}
            trailingIcon={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            onTrailingPress={() => setIsPasswordVisible(!isPasswordVisible)}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => setShowForgotPassword(true)}
          >
            <Text style={styles.forgotButtonText}>Lupa password?</Text>
          </TouchableOpacity>

          <AppButton label="Login" onPress={handleLogin} />
        </AppCard>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showForgotPassword} onRequestClose={() => setShowForgotPassword(false)}>
        <View style={styles.modalOverlay}>
          <AppCard style={styles.requestCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.requestTitle}>Permintaan Ganti Password</Text>
                <Text style={styles.requestCaption}>
                  Isi data berikut. Permintaan akan masuk ke admin untuk disetujui dari daftar pengajuan.
                </Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowForgotPassword(false)}>
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            <AppInput
              placeholder="Email akun"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <AppInput
              placeholder="Password baru"
              value={forgotPassword}
              onChangeText={setForgotPassword}
              secureTextEntry
            />

            <AppInput
              placeholder="Konfirmasi password baru"
              value={forgotPasswordConfirm}
              onChangeText={setForgotPasswordConfirm}
              secureTextEntry
            />

            <AppInput
              placeholder="Alasan ganti password"
              value={forgotReason}
              onChangeText={setForgotReason}
              multiline
              style={styles.reasonInput}
            />

            <AppButton
              label={forgotSubmitting ? "Mengirim..." : "Kirim Permintaan"}
              onPress={submitForgotPassword}
              disabled={forgotSubmitting}
            />
          </AppCard>
        </View>
      </Modal>
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
    position: "relative",
  },
  logoWrapper: {
    alignItems: "center",
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
    position: "absolute",
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
  },
  forgotButton: {
    alignSelf: "flex-start",
  },
  forgotButtonText: {
    color: AppTheme.colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppTheme.colors.overlay,
    justifyContent: "center",
    padding: 20,
  },
  requestCard: {
    gap: AppTheme.spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalClose: {
    backgroundColor: AppTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: AppTheme.radius.sm,
  },
  modalCloseText: {
    color: AppTheme.colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  requestTitle: {
    color: AppTheme.colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  requestCaption: {
    color: AppTheme.colors.textMuted,
    lineHeight: 20,
  },
  reasonInput: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: 14,
  },
});
