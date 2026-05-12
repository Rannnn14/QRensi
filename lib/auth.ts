import { supabase } from "./supabase"
import { supabaseAdmin } from "./supabaseAdmin"

type SessionUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    class_name?: string
    kelas?: string
    nisn?: string
    role?: string
  } | null
}

const getFallbackName = (user: SessionUser) =>
  user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Siswa")

const inferRole = (user: SessionUser, existingRole?: string | null) => {
  const metadataRole = String(user.user_metadata?.role || "").toLowerCase()

  if (metadataRole === "admin" || metadataRole === "user") {
    return metadataRole
  }

  if (existingRole) {
    return existingRole
  }

  return user.user_metadata?.class_name || user.user_metadata?.kelas || user.user_metadata?.nisn ? "user" : "admin"
}

export async function ensureProfileForUser(user: SessionUser) {
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, nama, kelas, role, nisn")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  const role = inferRole(user, existingProfile?.role)
  const nextProfile = {
    id: user.id,
    nama: existingProfile?.nama || getFallbackName(user),
    kelas:
      existingProfile?.kelas ||
      user.user_metadata?.class_name ||
      user.user_metadata?.kelas ||
      (role === "admin" ? "Admin" : "-"),
    role,
    nisn: existingProfile?.nisn || user.user_metadata?.nisn || null,
  }

  if (!existingProfile) {
    const { error } = await supabaseAdmin.from("profiles").upsert(nextProfile)

    if (error) {
      throw error
    }

    return nextProfile
  }

  const needsSync =
    !existingProfile.nama ||
    !existingProfile.kelas ||
    !existingProfile.role ||
    (!existingProfile.nisn && !!user.user_metadata?.nisn)

  if (needsSync) {
    const { error } = await supabaseAdmin.from("profiles").upsert(nextProfile)

    if (error) {
      throw error
    }

    return nextProfile
  }

  return existingProfile
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getRole(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  if (error || !data) return null
  return data.role
}
