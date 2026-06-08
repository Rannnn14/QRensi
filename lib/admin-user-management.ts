import { supabaseAdmin } from "./supabaseAdmin"
import { isValidStudentNisn, normalizeStudentName, normalizeStudentNisn } from "./student"

type StudentAccountInput = {
  email: string
  password: string
  nama: string
  kelas: string
  nisn: string
}

type StudentAccountUpdateInput = {
  userId: string
  currentEmail?: string | null
  nextEmail: string
  nextName: string
  nextClass: string
  nisn?: string | null
  nextPassword?: string
}

type AuthUserSummary = {
  id: string
  email?: string | null
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const listAuthUserEmailsById = async () => {
  const authUserMap = new Map<string, string>()
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const users = (data?.users || []) as AuthUserSummary[]
    users.forEach((item) => {
      if (item.id) {
        authUserMap.set(item.id, item.email || "")
      }
    })

    if (users.length < 200) {
      break
    }

    page += 1
  }

  return authUserMap
}

export const findAuthUserByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email)
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const users = (data?.users || []) as AuthUserSummary[]
    const matchedUser = users.find((item) => normalizeEmail(item.email || "") === normalizedEmail)

    if (matchedUser) {
      return matchedUser
    }

    if (users.length < 200) {
      return null
    }

    page += 1
  }
}

export const updateStudentAccount = async ({
  userId,
  currentEmail,
  nextEmail,
  nextName,
  nextClass,
  nisn,
  nextPassword,
}: StudentAccountUpdateInput) => {
  const normalizedNextEmail = normalizeEmail(nextEmail)
  const normalizedCurrentEmail = normalizeEmail(currentEmail || "")
  const normalizedName = normalizeStudentName(nextName)
  const normalizedNisn = normalizeStudentNisn(nisn || "")

  if (!normalizedNextEmail || !normalizedName || !nextClass) {
    throw new Error("Nama, email, dan kelas wajib diisi")
  }

  if (!isValidStudentNisn(normalizedNisn)) {
    throw new Error("NISN harus terdiri dari 10 digit")
  }

  if (nextPassword && nextPassword.trim().length < 6) {
    throw new Error("Kata sandi baru minimal 6 karakter")
  }

  if (normalizedNextEmail !== normalizedCurrentEmail) {
    const existingUser = await findAuthUserByEmail(normalizedNextEmail)
    if (existingUser?.id && existingUser.id !== userId) {
      throw new Error("Email sudah terdaftar")
    }
  }

  const authPayload: {
    email?: string
    password?: string
    user_metadata: {
      full_name: string
      class_name: string
      kelas: string
      nisn: string
      role: string
    }
  } = {
    user_metadata: {
      full_name: normalizedName,
      class_name: nextClass,
      kelas: nextClass,
      nisn: normalizedNisn,
      role: "user",
    },
  }

  if (normalizedNextEmail !== normalizedCurrentEmail) {
    authPayload.email = normalizedNextEmail
  }

  if (nextPassword?.trim()) {
    authPayload.password = nextPassword.trim()
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authPayload)
  if (authError) {
    throw new Error(authError.message)
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      nama: normalizedName,
      kelas: nextClass,
      nisn: normalizedNisn,
    })
    .eq("id", userId)

  if (profileError) {
    throw new Error(profileError.message)
  }

  return {
    email: normalizedNextEmail,
    nama: normalizedName,
    kelas: nextClass,
    nisn: normalizedNisn,
  }
}

export const createStudentAccount = async ({
  email,
  password,
  nama,
  kelas,
  nisn,
}: StudentAccountInput) => {
  const normalizedEmail = normalizeEmail(email)
  const normalizedName = normalizeStudentName(nama)
  const normalizedNisn = normalizeStudentNisn(nisn)

  if (!normalizedEmail || !password || !normalizedName || !kelas || !normalizedNisn) {
    throw new Error("Semua kolom harus diisi")
  }

  if (password.trim().length < 6) {
    throw new Error("Kata sandi minimal 6 karakter")
  }

  if (!isValidStudentNisn(normalizedNisn)) {
    throw new Error("NISN harus terdiri dari 10 digit")
  }

  const { data: existingProfileByNisn, error: profileNisnError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("nisn", normalizedNisn)
    .maybeSingle()

  if (profileNisnError) {
    throw new Error(profileNisnError.message)
  }

  if (existingProfileByNisn) {
    throw new Error("Akun ini sudah digunakan")
  }

  let authUser = await findAuthUserByEmail(normalizedEmail)
  if (authUser) {
    throw new Error("Akun ini sudah digunakan")
  }

  let createdInThisAttempt = false

  if (!authUser) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        class_name: kelas,
        kelas,
        nisn: normalizedNisn,
        role: "user",
      },
    })

    if (authError) {
      const errorMessage = String(authError.message || "")

      if (errorMessage.toLowerCase().includes("already registered")) {
        authUser = await findAuthUserByEmail(normalizedEmail)
      } else {
        throw new Error(authError.message)
      }
    } else {
      createdInThisAttempt = true
      authUser = authData?.user
        ? {
            id: authData.user.id,
            email: authData.user.email,
          }
        : null
    }
  }

  if (!authUser?.id) {
    throw new Error("Gagal menyiapkan akun masuk siswa.")
  }

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, nama, kelas, nisn, role")
    .eq("id", authUser.id)
    .maybeSingle()

  if (existingProfileError) {
    throw new Error(existingProfileError.message)
  }

  if (
    existingProfile &&
    !createdInThisAttempt &&
    (
      normalizeStudentName(existingProfile.nama || "") !== normalizedName ||
      String(existingProfile.kelas || "") !== kelas ||
      normalizeStudentNisn(existingProfile.nisn || "") !== normalizedNisn ||
      String(existingProfile.role || "user") !== "user"
    )
  ) {
    throw new Error("Email sudah terdaftar")
  }

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    password,
    user_metadata: {
      full_name: normalizedName,
      class_name: kelas,
      kelas,
      nisn: normalizedNisn,
      role: "user",
    },
  })

  if (authUpdateError) {
    throw new Error(authUpdateError.message)
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: authUser.id,
    role: "user",
    nama: normalizedName,
    kelas,
    nisn: normalizedNisn,
  })

  if (profileError) {
    throw new Error(profileError.message)
  }

  return {
    id: authUser.id,
    email: normalizedEmail,
    nama: normalizedName,
    kelas,
    nisn: normalizedNisn,
  }
}
