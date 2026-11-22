import { Capacitor } from '@capacitor/core'

/**
 * Supabase auth storage:
 * - Web: localStorage
 * - Native: memory → localStorage (hızlı) → Preferences (kalıcı)
 *
 * ÖNEMLİ: Hiçbir Preferences çağrısı sonsuza kadar beklenmez (max 3 sn).
 * Hydrate render'ı BLOKLAMAZ — arka planda çalışır.
 */
let PreferencesApi = null
let preferencesPromise = null
let hydrated = false
let hydratePromise = null
const memoryCache = new Map()
const PREFS_TIMEOUT_MS = 3000

async function getPreferences() {
  // Playwright / test: window.__MOCK_PREFS__ ile hang|throw|ok senaryoları
  if (typeof window !== 'undefined' && window.__MOCK_PREFS__) {
    return window.__MOCK_PREFS__
  }
  if (PreferencesApi) return PreferencesApi
  if (!Capacitor.isNativePlatform()) return null
  if (!preferencesPromise) {
    preferencesPromise = import('@capacitor/preferences')
      .then((mod) => {
        PreferencesApi = mod.Preferences
        return PreferencesApi
      })
      .catch((err) => {
        console.warn('[authStorage] Preferences import başarısız', err)
        preferencesPromise = null
        return null
      })
  }
  return preferencesPromise
}

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => {
      if (timer) window.clearTimeout(timer)
    }),
    new Promise((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error(`[authStorage] zaman aşımı: ${label}`)),
        ms
      )
    }),
  ])
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
 * Arka plan hydrate — render BEKLEMEZ.
 * Preferences asılı kalsa bile 3 sn sonra biter; oturumsuz devam edilir.
 */
export function hydrateAuthStorage() {
  if (hydratePromise) return hydratePromise
  if (hydrated) return Promise.resolve()

  hydratePromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      hydrated = true
      return
    }

    try {
      const Prefs = await withTimeout(getPreferences(), PREFS_TIMEOUT_MS, 'Preferences import')
      if (!Prefs) {
        hydrated = true
        return
      }

      const { keys } = await withTimeout(Prefs.keys(), PREFS_TIMEOUT_MS, 'Preferences.keys')
      const authKeys = (keys || []).filter(
        (k) => k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase')
      )

      await withTimeout(
        Promise.all(
          authKeys.map(async (key) => {
            try {
              const { value } = await withTimeout(
                Prefs.get({ key }),
                PREFS_TIMEOUT_MS,
                `Preferences.get:${key}`
              )
              memoryCache.set(key, value ?? null)
              if (value != null) writeLocal(key, value)
            } catch {
              /* tek anahtar başarısız — devam */
            }
          })
        ),
        PREFS_TIMEOUT_MS,
        'Preferences hydrate all'
      )
    } catch (err) {
      console.warn('[authStorage] hydrate atlandı', err?.message || err)
    } finally {
      hydrated = true
    }
  })()

  return hydratePromise
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
      if (!Capacitor.isNativePlatform()) return null
      const Prefs = await withTimeout(getPreferences(), PREFS_TIMEOUT_MS, 'getItem import')
      if (!Prefs) return null
      const { value } = await withTimeout(Prefs.get({ key }), PREFS_TIMEOUT_MS, `getItem:${key}`)
      if (value != null) {
        memoryCache.set(key, value)
        writeLocal(key, value)
        return value
      }
      memoryCache.set(key, null)
      return null
    } catch (err) {
      console.warn('[authStorage] getItem', err?.message || err)
      return readLocal(key)
    }
  },

  async setItem(key, value) {
    memoryCache.set(key, value)
    writeLocal(key, value)
    try {
      if (!Capacitor.isNativePlatform()) return
      const Prefs = await withTimeout(getPreferences(), PREFS_TIMEOUT_MS, 'setItem import')
      if (Prefs) {
        await withTimeout(Prefs.set({ key, value }), PREFS_TIMEOUT_MS, `setItem:${key}`)
      }
    } catch (err) {
      console.warn('[authStorage] setItem', err?.message || err)
    }
  },

  async removeItem(key) {
    memoryCache.delete(key)
    writeLocal(key, null)
    try {
      if (!Capacitor.isNativePlatform()) return
      const Prefs = await withTimeout(getPreferences(), PREFS_TIMEOUT_MS, 'removeItem import')
      if (Prefs) {
        await withTimeout(Prefs.remove({ key }), PREFS_TIMEOUT_MS, `removeItem:${key}`)
      }
    } catch (err) {
      console.warn('[authStorage] removeItem', err?.message || err)
    }
  },
}
