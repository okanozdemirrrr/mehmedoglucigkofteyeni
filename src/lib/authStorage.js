import { Capacitor } from '@capacitor/core'

/**
 * Supabase auth storage (iOS hız odaklı):
 * 1) memory → 2) localStorage (senkron) → 3) Preferences (kalıcı)
 * Native'de Preferences WebView temizlense bile oturumu tutar;
 * okumalar mümkün olduğunca senkron localStorage/memory üzerinden gider.
 */
let PreferencesApi = null
let preferencesPromise = null
let hydrated = false
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

function readLocal(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/**
 * createClient'tan ÖNCE çağır: Preferences'taki sb-* anahtarlarını memory+localStorage'a yükler.
 * iOS cold start'ta async Preferences köprüsünü UI'dan önce tek seferde bitirir.
 */
export async function hydrateAuthStorage() {
  if (hydrated) return
  hydrated = true
  if (!Capacitor.isNativePlatform()) return

  try {
    const Prefs = await getPreferences()
    if (!Prefs) return
    const { keys } = await Prefs.keys()
    const authKeys = (keys || []).filter(
      (k) => k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase')
    )
    await Promise.all(
      authKeys.map(async (key) => {
        const { value } = await Prefs.get({ key })
        memoryCache.set(key, value ?? null)
        if (value != null) writeLocal(key, value)
      })
    )
  } catch (err) {
    console.warn('[authStorage] hydrate', err)
  }
}

export const authStorage = {
  async getItem(key) {
    if (memoryCache.has(key)) {
      return memoryCache.get(key)
    }

    const local = readLocal(key)
    if (local != null) {
      memoryCache.set(key, local)
      return local
    }

    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        const { value } = await Prefs.get({ key })
        if (value != null) {
          memoryCache.set(key, value)
          writeLocal(key, value)
          return value
        }
        memoryCache.set(key, null)
        return null
      }
      return null
    } catch (err) {
      console.warn('[authStorage] getItem', err)
      return readLocal(key)
    }
  },

  async setItem(key, value) {
    memoryCache.set(key, value)
    writeLocal(key, value)
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        await Prefs.set({ key, value })
      }
    } catch (err) {
      console.warn('[authStorage] setItem', err)
    }
  },

  async removeItem(key) {
    memoryCache.delete(key)
    writeLocal(key, null)
    try {
      const Prefs = await getPreferences()
      if (Prefs) {
        await Prefs.remove({ key })
      }
    } catch (err) {
      console.warn('[authStorage] removeItem', err)
    }
  },
}
