import { supabase } from "./supabase"

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