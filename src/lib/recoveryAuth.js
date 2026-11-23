import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Gerçek bellek deposu (no-op storage setSession sonrası oturumu kaybettirir). */
function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

/**
 * Şifre yenileme için bellek-only istemci — ana authStorage / oturum kalıcılığına dokunmaz.
 */
export function createRecoveryClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: createMemoryStorage(),
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function withTimeout(promise, ms, message = 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer)
  })
}

/** URL hash veya query’den recovery oturumu kur. */
export async function establishRecoverySession(client) {
  if (!client || typeof window === 'undefined') {
    return { ok: false, reason: 'missing' }
  }

  const hash = window.location.hash?.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash || ''
  const hashParams = new URLSearchParams(hash)
  const queryParams = new URLSearchParams(window.location.search)

  const errorDescription =
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error')
  if (errorDescription) {
    return { ok: false, reason: 'invalid' }
  }

  const type = hashParams.get('type') || queryParams.get('type')
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')

  if (accessToken && refreshToken && (type === 'recovery' || !type)) {
    const { error } = await withTimeout(
      client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      15000
    )
    if (error) return { ok: false, reason: 'invalid' }
    return { ok: true }
  }

  const code = queryParams.get('code')
  if (code) {
    const { error } = await withTimeout(client.auth.exchangeCodeForSession(code), 15000)
    if (error) return { ok: false, reason: 'invalid' }
    return { ok: true }
  }

  return { ok: false, reason: 'missing' }
}
