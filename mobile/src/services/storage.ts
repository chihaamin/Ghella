/**
 * Synchronous key/value facade over AsyncStorage.
 *
 * The web app leaned on localStorage being synchronous — the HTTP stale-cache
 * and the zustand persist gate both read during render. Rather than rewrite
 * every caller async, the whole `ghella:` keyspace is loaded into memory once
 * at boot (`hydrateStorage`, awaited before the first screen mounts) and every
 * write goes through the map first, then fire-and-forget to AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage"

const PREFIX = "ghella:"
const mem = new Map<string, string>()
let hydrated = false

/** Load every ghella:* key into memory. Await once, before first render. */
export async function hydrateStorage(): Promise<void> {
  if (hydrated) return
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith(PREFIX)
    )
    if (keys.length > 0) {
      const pairs = await AsyncStorage.multiGet(keys)
      for (const [key, value] of pairs) {
        if (value != null) mem.set(key, value)
      }
    }
  } catch {
    // A wiped or unreadable store is a cold start, not a crash.
  }
  hydrated = true
}

export function kvGet(key: string): string | null {
  return mem.get(key) ?? null
}

export function kvSet(key: string, value: string): void {
  mem.set(key, value)
  AsyncStorage.setItem(key, value).catch(() => {})
}

export function kvRemove(key: string): void {
  mem.delete(key)
  AsyncStorage.removeItem(key).catch(() => {})
}

/** Every stored key with the given prefix — the cache pruner walks these. */
export function kvKeys(prefix: string): string[] {
  return [...mem.keys()].filter((k) => k.startsWith(prefix))
}

/** zustand `createJSONStorage` adapter over the same memory-first store. */
export const kvStateStorage = {
  getItem: (name: string) => kvGet(name),
  setItem: (name: string, value: string) => kvSet(name, value),
  removeItem: (name: string) => kvRemove(name),
}
