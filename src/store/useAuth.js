import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

let didInitialize = false
const AUTH_TIMEOUT_MS = 8000
/** Aynı kullanıcı için eşzamanlı/çift profil fetch'ini birleştir */
let inflightProfile = null

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

    // Listener'dan önce session oku — Preferences hydrate sonrası hızlı path
    void supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        void get().fetchProfile(data.session.user)
      }
    })

    supabase.auth.onAuthStateChange((event, session) => {
      // Callback must stay sync. Awaiting supabase calls here deadlocks the client.
      window.setTimeout(() => {
        if (session?.user) {
          void get().fetchProfile(session.user)
          return
        }
        // Oturum yok: sadece kesin olaylarda temizle (TOKEN_REFRESHED null ile yarışmasın)
        if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          inflightProfile = null
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

    if (inflightProfile?.userId === user.id) {
      return inflightProfile.promise
    }

    const promise = (async () => {
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
      } finally {
        if (inflightProfile?.userId === user.id) inflightProfile = null
      }
    })()

    inflightProfile = { userId: user.id, promise }
    return promise
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      // onAuthStateChange da tetiklenir; inflight dedupe çift profil isteğini birleştirir
      // Push yalnız Layout'ta (ertelenmiş) — giriş anında izin diyaloğu iOS'u dondurmasın
      await get().fetchProfile(data.user)
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
