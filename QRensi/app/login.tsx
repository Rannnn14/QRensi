import { useState } from "react"
import { View, TextInput, Button, Text } from "react-native"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    router.replace("/")
  }

  return (
    <View style={{ padding:20, marginTop:100 }}>
      <TextInput placeholder="Email" onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} />

      {error ? <Text style={{ color:"red" }}>{error}</Text> : null}

      <Button title="Login" onPress={handleLogin} />
    </View>
  )
}