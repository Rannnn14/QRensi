import { Platform } from "react-native"
import Constants from "expo-constants"

let configured = false

const isExpoGo = Constants.appOwnership === "expo"

const getNotificationsModule = async () => {
  try {
    const module = await import("expo-notifications")
    return module?.default ? { ...module.default, ...module } : module
  } catch (error) {
    console.log("expo-notifications belum siap:", error)
    return null
  }
}

export const prepareNotifications = async () => {
  if (isExpoGo) {
    return false
  }

  if (configured) return true

  const Notifications = await getNotificationsModule()
  if (!Notifications) return false

  if (typeof Notifications.setNotificationHandler === "function") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  }

  if (typeof Notifications.getPermissionsAsync !== "function") {
    return false
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted" && typeof Notifications.requestPermissionsAsync === "function") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") {
    return false
  }

  if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16324f",
    })
  }

  configured = true
  return true
}

export const sendLocalNotification = async (title: string, body: string) => {
  if (isExpoGo) {
    return false
  }

  const Notifications = await getNotificationsModule()
  if (!Notifications) return false

  const ready = await prepareNotifications()
  if (!ready) return false

  if (typeof Notifications.scheduleNotificationAsync !== "function") {
    return false
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  })

  return true
}
