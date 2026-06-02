import "react-native-url-polyfill/auto"
import { createClient } from "@supabase/supabase-js"
import { supabaseFetch } from "./supabaseFetch"

const supabaseUrl = "https://xarntfqxllizuehumayh.supabase.co"
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhcm50ZnF4bGxpenVlaHVtYXloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgxODA5MCwiZXhwIjoyMDg3Mzk0MDkwfQ.QPld9gbiarWY5V8H19SeriO4T0d4rgnfUlLFhEI51BA"

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  global: {
    fetch: supabaseFetch,
  },
})
