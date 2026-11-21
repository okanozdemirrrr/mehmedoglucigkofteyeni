import { Capacitor } from '@capacitor/core'

/**
 * Supabase auth storage:
 * - Native (iOS/Android): @capacitor/preferences (UserDefaults / SharedPreferences)
 * - Web: localStorage
 *
 * Bellek önbelleği: aynı oturum anahtarını açılışta tekrar tekrar Preferences'tan okumayı önler.
 */
let PreferencesApi = null
let preferencesPromise = null
const memoryCache = new Map()

async function getPreferences() {
  if (PreferencesApi) return PreferencesApi
  if (!Capacitor.isNativePlatform()) return null
  if (!preferencesPromise) {
    preferencesPromise = import('@capacitor/preferences').then((mod) => {
      PreferencesApi = mod.Preferences
      return PreferencesApi
    })
  }
  return preferencesPromise
}

export const authStorage = {
  async getItem(key) {
    if (memoryCache.has(key)) {
      return memoryCache.get(key)
    }
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        const { value } = await Prefs.get({ key })
        if (value != null) {
          memoryCache.set(key, value)
          return value
        }
        // Tek seferlik: eski localStorage oturumunu native depoya taşı
        try {
          const legacy = window.localStorage?.getItem(key)
          if (legacy) {
            await Prefs.set({ key, value: legacy })
            memoryCache.set(key, legacy)
            return legacy
          }
        } catch {
          /* ignore */
        }
        memoryCache.set(key, null)
        return null
      }
      const v = window.localStorage.getItem(key)
      memoryCache.set(key, v)
      return v
    } catch (err) {
      console.warn('[authStorage] getItem', err)
      try {
        const v = window.localStorage.getItem(key)
        memoryCache.set(key, v)
        return v
      } catch {
        return null
      }
    }
  },

  async setItem(key, value) {
    memoryCache.set(key, value)
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        await Prefs.set({ key, value })
        return
      }
      window.localStorage.setItem(key, value)
    } catch (err) {
      console.warn('[authStorage] setItem', err)
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* ignore */
      }
    }
  },

  async removeItem(key) {
    memoryCache.delete(key)
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        await Prefs.remove({ key })
      }
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.warn('[authStorage] removeItem', err)
    }
  },
}
