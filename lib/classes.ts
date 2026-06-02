import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabaseAdmin } from "./supabaseAdmin"

export const DEFAULT_CLASSES = ["7 Banin", "7 Banat", "8 Banin", "8 Banat", "9 Banin", "9 Banat"]

const CUSTOM_CLASSES_KEY = "qrensi-custom-classes"
const DELETED_CLASSES_KEY = "qrensi-deleted-classes"

export const normalizeClassName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

export const isSameClass = (left?: string | null, right?: string | null) =>
  normalizeClassName(String(left || "")).toLowerCase() ===
  normalizeClassName(String(right || "")).toLowerCase()

const classSortValue = (kelas: string) => {
  const grade = Number(kelas.match(/\d+/)?.[0] || 99)
  return `${String(grade).padStart(2, "0")}-${kelas.toLowerCase()}`
}

export const sortClasses = (items: string[]) =>
  [...items].sort((a, b) => classSortValue(a).localeCompare(classSortValue(b)))

export const mergeClasses = (...groups: Array<Array<string | null | undefined>>) => {
  const map = new Map<string, string>()

  groups.flat().forEach((item) => {
    const normalized = normalizeClassName(String(item || ""))
    if (normalized) {
      map.set(normalized.toLowerCase(), normalized)
    }
  })

  return sortClasses(Array.from(map.values()))
}

export const getStoredClasses = async () => {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_CLASSES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? mergeClasses(parsed) : []
  } catch {
    return []
  }
}

const getDeletedClasses = async () => {
  try {
    const raw = await AsyncStorage.getItem(DELETED_CLASSES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? mergeClasses(parsed) : []
  } catch {
    return []
  }
}

const setStoredClasses = async (items: string[]) => {
  await AsyncStorage.setItem(CUSTOM_CLASSES_KEY, JSON.stringify(mergeClasses(items)))
}

const setDeletedClasses = async (items: string[]) => {
  await AsyncStorage.setItem(DELETED_CLASSES_KEY, JSON.stringify(mergeClasses(items)))
}

const getRemoteClasses = async () => {
  try {
    const { data, error } = await supabaseAdmin.from("kelas").select("*")
    if (error || !Array.isArray(data)) {
      return []
    }

    return mergeClasses(
      data.map((item) => item.nama || item.name || item.kelas || item.label)
    )
  } catch {
    return []
  }
}

const saveRemoteClass = async (kelas: string) => {
  try {
    await supabaseAdmin.from("kelas").upsert({ nama: kelas }, { onConflict: "nama" })
  } catch {
    // The app remains usable even when the optional kelas table does not exist yet.
  }
}

const renameRemoteClass = async (oldClassName: string, newClassName: string) => {
  try {
    await supabaseAdmin.from("kelas").update({ nama: newClassName }).eq("nama", oldClassName)
  } catch {
    // Optional table; ignore when it does not exist.
  }
}

const deleteRemoteClass = async (kelas: string) => {
  try {
    await supabaseAdmin.from("kelas").delete().eq("nama", kelas)
  } catch {
    // Optional table; ignore when it does not exist.
  }
}

export const saveCustomClass = async (kelas: string) => {
  const normalized = normalizeClassName(kelas)
  if (!normalized) {
    throw new Error("Nama kelas wajib diisi.")
  }

  const stored = await getStoredClasses()
  const next = mergeClasses(stored, [normalized])
  const deleted = (await getDeletedClasses()).filter((item) => item.toLowerCase() !== normalized.toLowerCase())
  await setStoredClasses(next)
  await setDeletedClasses(deleted)
  await saveRemoteClass(normalized)
  return normalized
}

export const renameClass = async (oldClassName: string, newClassName: string) => {
  const oldNormalized = normalizeClassName(oldClassName)
  const newNormalized = normalizeClassName(newClassName)

  if (!oldNormalized || !newNormalized) {
    throw new Error("Nama kelas wajib diisi.")
  }

  if (oldNormalized.toLowerCase() === newNormalized.toLowerCase()) {
    return newNormalized
  }

  const stored = await getStoredClasses()
  const deleted = await getDeletedClasses()
  await setStoredClasses([
    ...stored.filter((item) => item.toLowerCase() !== oldNormalized.toLowerCase()),
    newNormalized,
  ])
  await setDeletedClasses([
    ...deleted.filter((item) => item.toLowerCase() !== newNormalized.toLowerCase()),
    oldNormalized,
  ])
  await renameRemoteClass(oldNormalized, newNormalized)
  await saveRemoteClass(newNormalized)
  return newNormalized
}

export const deleteClassName = async (kelas: string) => {
  const normalized = normalizeClassName(kelas)
  if (!normalized) {
    throw new Error("Nama kelas tidak valid.")
  }

  const stored = await getStoredClasses()
  const deleted = await getDeletedClasses()
  await setStoredClasses(stored.filter((item) => item.toLowerCase() !== normalized.toLowerCase()))
  await setDeletedClasses([...deleted, normalized])
  await deleteRemoteClass(normalized)
  return normalized
}

export const getAvailableClasses = async (profileClasses: Array<string | null | undefined> = []) => {
  const profileClassList = mergeClasses(profileClasses)
  const deleted = await getDeletedClasses()
  const deletedKeys = new Set(deleted.map((item) => item.toLowerCase()))

  return mergeClasses(DEFAULT_CLASSES, await getRemoteClasses(), await getStoredClasses(), profileClassList)
    .filter((kelas) => !deletedKeys.has(kelas.toLowerCase()) || profileClassList.some((item) => item.toLowerCase() === kelas.toLowerCase()))
}

export const getPromotedClass = (kelas: string) => {
  const normalized = normalizeClassName(kelas)
  const match = normalized.match(/^([789])\s+(.+)$/)

  if (!match) {
    return null
  }

  const grade = Number(match[1])
  const group = match[2]

  if (grade === 7) return `8 ${group}`
  if (grade === 8) return `9 ${group}`
  if (grade === 9) return "Alumni"

  return null
}
