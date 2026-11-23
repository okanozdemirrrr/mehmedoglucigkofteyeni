import { Capacitor } from '@capacitor/core'

/** Uygulama geneli sabitler — gizli anahtar koyma. */
export const SUPPORT_EMAIL = 'regoniletisim@gmail.com'

/**
 * Public web kök adresi (şifre sıfırlama e-posta linki vb.).
 * Öncelik: VITE_PUBLIC_WEB_URL → tarayıcıda window.location.origin → native’de null.
 */
export function getPublicWebOrigin() {
  const fromEnv = String(import.meta.env.VITE_PUBLIC_WEB_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window === 'undefined' || !window.location?.origin) return null

  try {
    if (Capacitor.isNativePlatform()) return null
  } catch {
    /* Capacitor yoksa web say */
  }

  const origin = String(window.location.origin || '').replace(/\/$/, '')
  if (/^https?:\/\//i.test(origin)) return origin
  return null
}

/** resetPasswordForEmail redirectTo — örn. https://site.com/sifre-yenile */
export function getPasswordResetRedirectTo() {
  const origin = getPublicWebOrigin()
  if (!origin) return null
  return `${origin}/sifre-yenile`
}
