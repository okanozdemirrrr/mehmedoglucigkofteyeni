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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, dealer_id, status')
        .eq('id', user.id)
        .single()

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
    if (!supabase) throw new Error('Supabase yapılandırılmamış')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      await get().fetchProfile(data.user)
    }

    return data
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    set({ user: null, profile: null, loading: false })
  },
}))
