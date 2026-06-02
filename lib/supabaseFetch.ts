export const getSupabaseNetworkMessage = () =>
  "Tidak bisa terhubung ke server QRensi. Periksa koneksi internet dan konfigurasi Supabase, lalu coba lagi."

const createNetworkErrorResponse = (message: string) =>
  new Response(JSON.stringify({ message, error: message }), {
    status: 503,
    statusText: "Service Unavailable",
    headers: {
      "Content-Type": "application/json",
    },
  })

export const supabaseFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init)
  } catch {
    return createNetworkErrorResponse(getSupabaseNetworkMessage())
  }
}
