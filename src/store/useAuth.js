import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

let didInitialize = false
const AUTH_TIMEOUT_MS = 8000

export const useAuth = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  initialize: () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ user: null, profile: null, loading: false })
      return
    }

    if (didInitialize) return
    didInitialize = true

    set({ loading: true })

    window.setTimeout(() => {
      if (get().loading) {
        console.warn('Oturum kontrolü zaman aşımına uğradı')
        set({ loading: false })
      }
    }, AUTH_TIMEOUT_MS)

    supabase.auth.onAuthStateChange((_event, session) => {
      // Callback must stay sync. Awaiting supabase calls here deadlocks the client.
      window.setTimeout(() => {
        if (session?.user) {
          void get().fetchProfile(session.user)
        } else {
          set({ user: null, profile: null, loading: false })
        }
      }, 0)
    })
  },

  fetchProfile: async (user) => {
    if (!supabase) {
      set({ user, profile: null, loading: false })
      return
    }

    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, dealer_id, status, is_demo, email')
        .eq('id', user.id)
        .single()

      // is_demo kolonu henüz yoksa geriye dönük uyumluluk
      if (error && /is_demo|column/i.test(error.message || '')) {
        const fallback = await supabase
          .from('profiles')
          .select('id, full_name, role, dealer_id, status, email')
          .eq('id', user.id)
          .single()
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('Profil yüklenemedi:', error.message)
        set({ user, profile: null, loading: false })
        return
      }

      set({ user, profile: data, loading: false })
    } catch (err) {
      console.error('Profil yüklenemedi:', err)
      set({ user, profile: null, loading: false })
    }
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      await get().fetchProfile(data.user)
      // Push izni + token kaydı (native / web)
      try {
        const { registerPushToken } = await import('../lib/notifications')
        void registerPushToken()
      } catch {
        /* push opsiyonel */
      }
    }

    return data
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    set({ user: null, profile: null, loading: false })
  },

  deleteAccount: async () => {
    if (!supabase) throw new Error('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')

    const profile = get().profile
    const email = (get().user?.email || profile?.email || '').toLowerCase()
    if (
      profile?.is_demo ||
      email === 'review-admin@regonteknoloji.com' ||
      email === 'review-bayi@regonteknoloji.com'
    ) {
      throw new Error('Demo / inceleme hesapları silinemez.')
    }

    const { error } = await supabase.rpc('delete_own_account')
    if (error) throw error

    try {
      await supabase.auth.signOut()
    } catch {
      /* hesap zaten silinmiş olabilir */
    }
    set({ user: null, profile: null, loading: false })
  },
}))
