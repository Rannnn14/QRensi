import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "../../components/ui/app-button";
import { AppCard } from "../../components/ui/app-card";
import { AppInput } from "../../components/ui/app-input";
import { AppTheme } from "../../constants/theme";
import { buildPasswordRequestNote } from "../../lib/pengajuan";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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
      setError("Email atau kata sandi tidak sesuai.");
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
      Alert.alert("Perhatian", "Semua kolom permintaan kata sandi harus diisi.");
      return;
    }

    if (forgotPassword.length < 6) {
      Alert.alert("Perhatian", "Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (forgotPassword !== forgotPasswordConfirm) {
      Alert.alert("Perhatian", "Konfirmasi kata sandi belum sama.");
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
        throw new Error("Permintaan ganti kata sandi masih menunggu persetujuan admin.");
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

      Alert.alert("Berhasil", "Permintaan ganti kata sandi sudah dikirim ke admin.");
      setForgotEmail("");
      setForgotPassword("");
      setForgotPasswordConfirm("");
      setForgotReason("");
      setShowForgotPassword(false);
    } catch (requestError: any) {
      Alert.alert("Gagal", requestError.message || "Gagal mengirim permintaan ganti kata sandi.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <View style={styles.brandChip}>
            <Image
              source={require("../../assets/images/logo_qrensii.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroEyebrow}>Platform Absensi SMPIT Fatahillah</Text>
          <Text style={styles.heroCaption}>
            Gunakan akun admin atau siswa untuk memantau kehadiran, pengajuan, dan QR harian.
          </Text>
        </View>

        <AppCard style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formEyebrow}>Akses akun</Text>
            <Text style={styles.formTitle}>Masuk</Text>
            <Text style={styles.formCaption}>
              Semua tampilan dan data akan menyesuaikan peran akun setelah login berhasil.
            </Text>
          </View>

          <View style={styles.formFields}>
            <AppInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <AppInput
              placeholder="Kata sandi"
              value={password}
              secureTextEntry={!isPasswordVisible}
              onChangeText={setPassword}
              trailingIcon={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
              onTrailingPress={() => setIsPasswordVisible((value) => !value)}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.forgotButton} onPress={() => setShowForgotPassword(true)}>
            <Text style={styles.forgotButtonText}>Lupa kata sandi?</Text>
            <Ionicons name="arrow-forward" size={16} color={AppTheme.colors.primary} />
          </TouchableOpacity>

          <AppButton label="Masuk" onPress={handleLogin} />
        </AppCard>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showForgotPassword} onRequestClose={() => setShowForgotPassword(false)}>
        <View style={styles.modalOverlay}>
          <AppCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>Bantuan akun</Text>
                <Text style={styles.modalTitle}>Permintaan Ganti Kata Sandi</Text>
                <Text style={styles.requestCaption}>
                  Isi detail berikut agar admin menerima permintaan penggantian kata sandi Anda.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowForgotPassword(false)}
              >
                <Ionicons name="close" size={18} color={AppTheme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFields}>
              <AppInput
                placeholder="Email akun"
                value={forgotEmail}
                onChangeText={setForgotEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <AppInput
                placeholder="Kata sandi baru"
                value={forgotPassword}
                onChangeText={setForgotPassword}
                secureTextEntry
              />

              <AppInput
                placeholder="Konfirmasi kata sandi baru"
                value={forgotPasswordConfirm}
                onChangeText={setForgotPasswordConfirm}
                secureTextEntry
              />

              <AppInput
                placeholder="Alasan ganti kata sandi"
                value={forgotReason}
                onChangeText={setForgotReason}
                multiline
                style={styles.reasonInput}
              />
            </View>

            <View style={styles.modalActions}>
              <AppButton
                label="Tutup"
                variant="ghost"
                onPress={() => setShowForgotPassword(false)}
              />
              <AppButton
                label={forgotSubmitting ? "Mengirim..." : "Kirim Permintaan"}
                onPress={submitForgotPassword}
                disabled={forgotSubmitting}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: AppTheme.spacing["2xl"],
  },
  hero: {
    backgroundColor: AppTheme.colors.primary,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingTop: AppTheme.spacing["4xl"],
    paddingBottom: 88,
    position: "relative",
    overflow: "hidden",
  },
  heroAccent: {
    position: "absolute",
    right: -48,
    top: -24,
    width: 176,
    height: 176,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  brandChip: {
    alignSelf: "flex-start",
    marginBottom: AppTheme.spacing.lg,
  },
  logo: {
    width: 156,
    height: 58,
  },
  heroEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: "#CFE0F1",
    marginBottom: AppTheme.spacing.sm,
  },
  heroCaption: {
    ...AppTheme.typography.body,
    color: "#D7E6F5",
    marginTop: AppTheme.spacing.md,
    maxWidth: 320,
  },
  formCard: {
    marginHorizontal: AppTheme.spacing.lg,
    marginTop: -56,
    gap: AppTheme.spacing.lg,
  },
  formHeader: {
    gap: AppTheme.spacing.xs,
  },
  formEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
  },
  formTitle: {
    ...AppTheme.typography.title,
  },
  formCaption: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
  },
  formFields: {
    gap: AppTheme.spacing.sm,
  },
  errorText: {
    ...AppTheme.typography.bodySm,
    color: AppTheme.colors.danger,
  },
  forgotButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.xs,
  },
  forgotButtonText: {
    fontFamily: AppTheme.fonts.semibold,
    fontSize: 13,
    lineHeight: 20,
    color: AppTheme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: AppTheme.spacing.lg,
    backgroundColor: AppTheme.colors.overlay,
  },
  modalCard: {
    gap: AppTheme.spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: AppTheme.spacing.xs,
  },
  modalEyebrow: {
    ...AppTheme.typography.eyebrow,
    color: AppTheme.colors.primary,
  },
  modalTitle: {
    ...AppTheme.typography.titleSm,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: AppTheme.radius.sm,
    backgroundColor: AppTheme.colors.backgroundMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  requestCaption: {
    ...AppTheme.typography.bodySm,
  },
  modalFields: {
    gap: AppTheme.spacing.sm,
  },
  reasonInput: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: AppTheme.spacing.md,
  },
  modalActions: {
    gap: AppTheme.spacing.sm,
  },
});
