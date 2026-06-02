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
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { ensureProfileForUser } from "../../lib/auth";
import { AppTheme } from "../../constants/theme";
import { AppButton } from "../../components/ui/app-button";
import { AppInput } from "../../components/ui/app-input";
import { AppCard } from "../../components/ui/app-card";
import { buildPasswordRequestNote } from "../../lib/pengajuan";
import { normalizeStudentNisn } from "../../lib/student";
import { getSupabaseNetworkMessage } from "../../lib/supabaseFetch";

type AuthUserSummary = {
  id: string;
  email?: string;
  user_metadata?: {
    nisn?: string;
    full_name?: string;
    class_name?: string;
    role?: string;
  } | null;
};

type ProfileRecord = {
  id?: string;
  nama?: string | null;
  kelas?: string | null;
  role?: string | null;
  nisn?: string | null;
  NISN?: string | null;
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNisn, setForgotNisn] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState("");
  const [forgotReason, setForgotReason] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [isForgotPasswordVisible, setIsForgotPasswordVisible] = useState(false);
  const [isForgotPasswordConfirmVisible, setIsForgotPasswordConfirmVisible] = useState(false);

  const isForgotPasswordMismatch =
    forgotPasswordConfirm.length > 0 && forgotPassword !== forgotPasswordConfirm;

  const getReadableAuthError = (authError: unknown) => {
    const message =
      authError instanceof Error
        ? authError.message
        : typeof authError === "string"
          ? authError
          : "Login gagal.";

    if (/network request failed|failed to fetch|networkerror|tidak bisa terhubung/i.test(message)) {
      return getSupabaseNetworkMessage();
    }

    return message;
  };

  const hasForgotPasswordDraft = Boolean(
    forgotEmail.trim() ||
    forgotNisn.trim() ||
    forgotPassword ||
    forgotPasswordConfirm ||
    forgotReason.trim()
  );

  const closeForgotPasswordModal = () => {
    setForgotEmail("");
    setForgotNisn("");
    setForgotPassword("");
    setForgotPasswordConfirm("");
    setForgotReason("");
    setIsForgotPasswordVisible(false);
    setIsForgotPasswordConfirmVisible(false);
    setShowForgotPassword(false);
  };

  const requestCloseForgotPasswordModal = () => {
    if (!hasForgotPasswordDraft || forgotSubmitting) {
      closeForgotPasswordModal();
      return;
    }

    Alert.alert(
      "Batalkan Perubahan?",
      "Apakah yakin ingin menutup form ganti password? Data yang sudah diisi akan hilang.",
      [
        { text: "Lanjut Isi", style: "cancel" },
        { text: "Ya", style: "destructive", onPress: closeForgotPasswordModal },
      ]
    );
  };

  const handleLogin = async () => {
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Masukkan email yang valid.");
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(getReadableAuthError(authError));
        return;
      }

      if (authData.user) {
        try {
          await ensureProfileForUser(authData.user);
        } catch (syncError) {
          console.log(
            "Gagal sinkron profil saat login:",
            syncError instanceof Error ? syncError.message : syncError
          );
        }
      }

      router.replace("/");
    } catch (loginError) {
      setError(getReadableAuthError(loginError));
    }
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

  const getProfileNisn = (profile?: ProfileRecord | null, authUser?: AuthUserSummary | null) =>
    normalizeStudentNisn(
      profile?.nisn ||
      profile?.NISN ||
      authUser?.user_metadata?.nisn ||
      ""
    );

  const processForgotPassword = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail || !forgotPassword || !forgotPasswordConfirm) {
      Alert.alert("Info", "Email dan password baru wajib diisi.");
      return;
    }

    if (forgotPassword.length < 6) {
      Alert.alert("Info", "Kata sandi baru minimal 6 karakter.");
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

      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const profile = (profileData || null) as ProfileRecord | null;

      const normalizedNisn = normalizeStudentNisn(forgotNisn);
      const storedNisn = getProfileNisn(profile, authUser);
      const isStudentAccount =
        String(profile?.role || authUser.user_metadata?.role || "").toLowerCase() === "user" ||
        Boolean(storedNisn);
      const isAdminAccount = !isStudentAccount;
      const accountName =
        profile?.nama || authUser.user_metadata?.full_name || normalizedEmail;
      const accountClass = profile?.kelas || authUser.user_metadata?.class_name || "Admin";

      if (isStudentAccount) {
        if (!profile && !storedNisn) {
          throw new Error("Akun siswa tidak ditemukan untuk email ini.");
        }

        if (!storedNisn) {
          throw new Error("NISN untuk akun siswa ini belum tersedia di database.");
        }

        if (!normalizedNisn) {
          throw new Error("NISN wajib diisi untuk akun siswa.");
        }

        if (storedNisn !== normalizedNisn) {
          throw new Error("NISN tidak sesuai.");
        }

        if (!forgotReason.trim()) {
          throw new Error("Alasan ganti password wajib diisi untuk akun siswa.");
        }
      }

      if (isAdminAccount) {
        if (storedNisn) {
          throw new Error("Email ini terdaftar sebagai akun siswa. Gunakan tab Siswa.");
        }

        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: forgotPassword,
        });

        if (passwordError) {
          throw passwordError;
        }

        Alert.alert("Berhasil", "Kata sandi admin berhasil diganti.");
        closeForgotPasswordModal();
        return;
      }

      const { data: existingRequest, error: existingError } = await supabaseAdmin
        .from("pengajuan")
        .select("id")
        .eq("user_id", authUser.id)
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
          user_id: authUser.id,
          nama: accountName,
          kelas: isAdminAccount ? "Admin" : accountClass,
          jenis: "ganti_password",
          keterangan: buildPasswordRequestNote({
            password: forgotPassword,
            alasan: forgotReason.trim(),
            email: normalizedEmail,
            nisn: isStudentAccount ? normalizedNisn : undefined,
            role: isAdminAccount ? "admin" : "user",
          }),
          status: "pending",
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      Alert.alert("Berhasil", "Permintaan ganti password sudah dikirim ke admin.");
      closeForgotPasswordModal();
    } catch (requestError) {
      Alert.alert("Error", getReadableAuthError(requestError));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const submitForgotPassword = () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();

    if (!normalizedEmail || !forgotPassword || !forgotPasswordConfirm) {
      Alert.alert("Info", "Email dan password baru wajib diisi.");
      return;
    }

    if (forgotPassword !== forgotPasswordConfirm) {
      Alert.alert("Info", "Konfirmasi password belum sama.");
      return;
    }

    const hasStudentFields = Boolean(forgotNisn.trim() || forgotReason.trim());
    const confirmMessage = hasStudentFields
      ? "Apakah Bapak/Ibu yakin ingin mengganti password?"
      : "Apakah admin yakin ingin ganti password :) ??";

    Alert.alert(
      "Konfirmasi Ganti Kata Sandi",
      confirmMessage,
      [
        { text: "Periksa Lagi", style: "cancel" },
        {
          text: "Ya",
          onPress: () => {
            processForgotPassword();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={styles.headerContainer}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />

          <View style={styles.logoWrapper}>
            <Image
              source={require("../../assets/images/Logo2.png")}
              style={styles.logoPrimary}
              resizeMode="contain"
            />
          </View>

          <View style={styles.waveDecorator} />
        </View>

        <AppCard style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.welcomeEyebrow}>Absensi sekolah aman</Text>
            <Text style={styles.welcomeText}>Masuk ke panel QRensi</Text>
          </View>
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
            placeholder="Kata sandi"
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
            <Text style={styles.forgotButtonText}>Lupa kata sandi?</Text>
          </TouchableOpacity>

          <AppButton label="Masuk" onPress={handleLogin} />
        </AppCard>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showForgotPassword} onRequestClose={requestCloseForgotPasswordModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestCloseForgotPasswordModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardWrap}
          >
            <AppCard style={styles.requestCard}>
              <View style={styles.modalTopAccent} />
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="lock-closed-outline" size={20} color={AppTheme.colors.primary} />
                </View>
                <TouchableOpacity style={styles.modalCloseIconButton} onPress={requestCloseForgotPasswordModal}>
                  <Ionicons name="close" size={18} color={AppTheme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.requestContent}
              >
                <View style={styles.modalTitleWrap}>
                  <Text style={styles.requestTitle}>Atur Ulang Kata Sandi</Text>
                </View>

                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={18} color={AppTheme.colors.info} />
                  <Text style={styles.infoBannerText}>
                    Admin cukup masukkan email yang sesuai. Jika akun ini milik siswa, isi NISN dan alasan.
                  </Text>
                </View>

                <AppInput
                  placeholder="Email akun"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <AppInput
                  placeholder="NISN"
                  value={forgotNisn}
                  onChangeText={(text) => setForgotNisn(normalizeStudentNisn(text))}
                  keyboardType="number-pad"
                />

                <AppInput
                  placeholder="Kata sandi baru"
                  value={forgotPassword}
                  onChangeText={setForgotPassword}
                  secureTextEntry={!isForgotPasswordVisible}
                  trailingIcon={isForgotPasswordVisible ? "eye-outline" : "eye-off-outline"}
                  onTrailingPress={() => setIsForgotPasswordVisible((prev) => !prev)}
                />

                <AppInput
                  placeholder="Konfirmasi kata sandi baru"
                  value={forgotPasswordConfirm}
                  onChangeText={setForgotPasswordConfirm}
                  secureTextEntry={!isForgotPasswordConfirmVisible}
                  trailingIcon={isForgotPasswordConfirmVisible ? "eye-outline" : "eye-off-outline"}
                  onTrailingPress={() => setIsForgotPasswordConfirmVisible((prev) => !prev)}
                />

                {isForgotPasswordMismatch ? (
                  <View style={styles.warningBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color={AppTheme.colors.danger} />
                    <Text style={styles.warningBannerText}>
                      Konfirmasi kata sandi belum sama dengan kata sandi baru.
                    </Text>
                  </View>
                ) : null}

                <AppInput
                  placeholder="Alasan"
                  value={forgotReason}
                  onChangeText={setForgotReason}
                  multiline
                  style={styles.reasonInput}
                />

                <View style={styles.modalActionRow}>
                  <TouchableOpacity style={styles.secondaryModalButton} onPress={requestCloseForgotPasswordModal}>
                    <Text style={styles.secondaryModalButtonText}>Batal</Text>
                  </TouchableOpacity>
                  <View style={styles.primaryButtonWrap}>
                    <AppButton
                      label={forgotSubmitting ? "Memproses..." : "Lanjutkan"}
                      onPress={submitForgotPassword}
                      disabled={forgotSubmitting || isForgotPasswordMismatch}
                    />
                  </View>
                </View>
              </ScrollView>
            </AppCard>
          </KeyboardAvoidingView>
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
    minHeight: 360,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: "flex-start",
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 72,
  },
  logoWrapper: {
    alignItems: "center",
    zIndex: 2,
    gap: 10,
    marginTop: -24,
  },
  heroGlowLarge: {
    position: "absolute",
    top: -70,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroGlowSmall: {
    position: "absolute",
    top: 110,
    left: -40,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  logoPrimary: {
    width: 450,
    height: 300,
  },
  waveDecorator: {
    position: "absolute",
    bottom: -70,
    left: 0,
    right: 0,
    height: 170,
    backgroundColor: AppTheme.colors.background,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
    transform: [{ scaleX: 1.18 }],
  },
  formContainer: {
    marginHorizontal: 20,
    marginTop: -64,
    gap: AppTheme.spacing.md,
    borderRadius: 26,
    padding: 20,
    ...AppTheme.shadow.md,
  },
  formHeader: {
    gap: 6,
  },
  welcomeEyebrow: {
    ...AppTheme.typography.eyebrow,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  welcomeText: {
    ...AppTheme.typography.title,
  },
  welcomeCaption: {
    ...AppTheme.typography.body,
    color: AppTheme.colors.textMuted,
    marginBottom: 4,
  },
  errorText: {
    color: AppTheme.colors.danger,
    textAlign: "left",
    fontSize: 13,
  },
  forgotButton: {
    alignSelf: "flex-start",
    marginTop: 2,
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
  modalKeyboardWrap: {
    width: "100%",
    justifyContent: "center",
  },
  requestCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
    maxHeight: "86%",
    borderRadius: 26,
  },
  requestContent: {
    paddingHorizontal: AppTheme.spacing.lg,
    paddingBottom: AppTheme.spacing.lg,
    gap: 10,
  },
  modalTopAccent: {
    height: 8,
    backgroundColor: AppTheme.colors.accent,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: AppTheme.spacing.md,
    paddingHorizontal: AppTheme.spacing.lg,
    paddingTop: AppTheme.spacing.lg,
    paddingBottom: 6,
  },
  modalTitleWrap: {
    gap: 2,
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: AppTheme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.primarySoft,
  },
  modalCloseIconButton: {
    width: 38,
    height: 38,
    borderRadius: AppTheme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  requestTitle: {
    color: AppTheme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  requestCaption: {
    color: AppTheme.colors.textMuted,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: AppTheme.spacing.sm,
    backgroundColor: "#F3F8FF",
    borderRadius: 18,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#D9E7F6",
  },
  infoBannerText: {
    flex: 1,
    color: AppTheme.colors.info,
    lineHeight: 19,
    fontSize: 13,
    fontWeight: "700",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    backgroundColor: AppTheme.colors.dangerSoft,
    borderRadius: AppTheme.radius.md,
    paddingHorizontal: AppTheme.spacing.md,
    paddingVertical: AppTheme.spacing.sm,
    borderWidth: 1,
    borderColor: "#F3B5B5",
  },
  warningBannerText: {
    flex: 1,
    color: AppTheme.colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  reasonInput: {
    minHeight: 84,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: AppTheme.spacing.sm,
    marginTop: AppTheme.spacing.xs,
  },
  secondaryModalButton: {
    minHeight: 48,
    paddingHorizontal: AppTheme.spacing.lg,
    borderRadius: AppTheme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.borderStrong,
    backgroundColor: AppTheme.colors.surfaceMuted,
  },
  secondaryModalButtonText: {
    color: AppTheme.colors.primary,
    fontWeight: "800",
  },
  primaryButtonWrap: {
    flex: 1,
  },
});
