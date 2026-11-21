import { Capacitor } from '@capacitor/core'

/**
 * Supabase auth storage:
 * - Native (iOS/Android): @capacitor/preferences (UserDefaults / SharedPreferences)
 * - Web: localStorage
 *
 * iOS WKWebView localStorage uygulama kapanınca / düşük depoda silinebilir.
 */
let PreferencesApi = null

async function getPreferences() {
  if (PreferencesApi) return PreferencesApi
  if (!Capacitor.isNativePlatform()) return null
  const mod = await import('@capacitor/preferences')
  PreferencesApi = mod.Preferences
  return PreferencesApi
}

export const authStorage = {
  async getItem(key) {
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        const { value } = await Prefs.get({ key })
        if (value != null) return value
        // Tek seferlik: eski localStorage oturumunu native depoya taşı
        try {
          const legacy = window.localStorage?.getItem(key)
          if (legacy) {
            await Prefs.set({ key, value: legacy })
            return legacy
          }
        } catch {
          /* ignore */
        }
        return null
      }
      return window.localStorage.getItem(key)
    } catch (err) {
      console.warn('[authStorage] getItem', err)
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    }
  },

  async setItem(key, value) {
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
