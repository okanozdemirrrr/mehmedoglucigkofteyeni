import { Capacitor } from '@capacitor/core'
import { supabase } from './supabaseClient'

/** Cihaz push token'ını Supabase'e kaydet */
export async function registerPushToken(existingUserId) {
  if (!supabase) return null

  // getUser() ağ turu yapar; oturum zaten varsa session'dan al
  let userId = existingUserId || null
  if (!userId) {
    const { data } = await supabase.auth.getSession()
    userId = data?.session?.user?.id || null
  }
  if (!userId) return null

  let token = null
  let platform = 'web'

  if (Capacitor.isNativePlatform()) {
    platform = Capacitor.getPlatform()
    token = await registerNativePush()
  }

  if (!token) return null

  const { error } = await supabase.rpc('upsert_push_token', {
    p_token: token,
    p_platform: platform,
  })

  if (error) {
    console.warn('Push token kaydı başarısız:', error.message)
    return null
  }

  return token
}

async function registerNativePush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') return null

    await PushNotifications.register()

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 12000)

      PushNotifications.addListener('registration', (t) => {
        clearTimeout(timeout)
        resolve(t.value)
      })

      PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeout)
        resolve(null)
      })
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
    const perm = await LocalNotifications.requestPermissions()
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
