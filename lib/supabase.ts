import "react-native-url-polyfill/auto"
import { createClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabaseFetch } from "./supabaseFetch"

const supabaseUrl = "https://xarntfqxllizuehumayh.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhcm50ZnF4bGxpenVlaHVtYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTgwOTAsImV4cCI6MjA4NzM5NDA5MH0.G4EIFSA4Gw9C6nfVrxipC_-e2qUWHRtG2CvZDzILnF0"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storage: AsyncStorage,
    storageKey: "qrensi-auth-session",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
  
