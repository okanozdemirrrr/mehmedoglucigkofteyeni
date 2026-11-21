import { Capacitor } from '@capacitor/core'
import { supabase } from './supabaseClient'

let pushInFlight = null

/**
 * Push kaydı UI'yı bloklamasın: kısa gecikmeyle, oturum başına bir kez.
 * iOS izin diyaloğu WebView'i dondurur → açılış/girişten sonra ertelenir.
 */
export function registerPushToken(existingUserId) {
  if (pushInFlight) return pushInFlight

  pushInFlight = (async () => {
    await new Promise((r) => window.setTimeout(r, 4500))

    if (!supabase) return null
    if (!Capacitor.isNativePlatform()) return null

    let userId = existingUserId || null
    if (!userId) {
      const { data } = await supabase.auth.getSession()
      userId = data?.session?.user?.id || null
    }
    if (!userId) return null

    const token = await registerNativePush()
    if (!token) return null

    const { error } = await supabase.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Capacitor.getPlatform(),
    })

    if (error) {
      console.warn('Push token kaydı başarısız:', error.message)
      return null
    }
    return token
  })().catch((err) => {
    console.warn('Push kayıt atlandı:', err)
    return null
  })

  return pushInFlight
}

async function registerNativePush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'denied') return null

    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return null

    return await new Promise((resolve) => {
      let settled = false
      const finish = (value) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        resolve(value)
      }
      const timeout = window.setTimeout(() => finish(null), 4000)

      void PushNotifications.addListener('registration', (t) => finish(t?.value || null))
      void PushNotifications.addListener('registrationError', () => finish(null))
      void PushNotifications.register().catch(() => finish(null))
    })
  } catch (err) {
    console.warn('Native push kayıt hatası:', err)
    return null
  }
}

/** Uygulama açıkken yerel sistem bildirimi */
export async function showLocalNotification(title, body, extra = {}) {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1000000) + 1,
          title,
          body,
          extra,
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    })
  } catch (err) {
    console.warn('Local notification hatası:', err)
  }
}

export async function fetchNotifications(limit = 40) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, link, is_read, created_at, data')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('Bildirimler yüklenemedi:', error.message)
    return []
  }
  return data || []
}

export async function markNotificationRead(id) {
  if (!supabase || !id) return
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function markAllNotificationsRead() {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc('mark_all_notifications_read')
  if (error) {
    console.warn('Tümünü okundu işaretle başarısız:', error.message)
    return 0
  }
  return data || 0
}
