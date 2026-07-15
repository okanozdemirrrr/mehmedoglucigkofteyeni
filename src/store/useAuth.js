import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

export const useAuth = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  initialize: async () => {
    set({ loading: true })

    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      await get().fetchProfile(session.user)
    } else {
      set({ user: null, profile: null, loading: false })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await get().fetchProfile(session.user)
      } else {
        set({ user: null, profile: null, loading: false })
      }
    })
  },

  fetchProfile: async (user) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, dealer_id')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Profil yüklenemedi:', error.message)
      set({ user, profile: null, loading: false })
      return
    }

    set({ user, profile: data, loading: false })
  },

  signIn: async (email, password) => {
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
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
}))
