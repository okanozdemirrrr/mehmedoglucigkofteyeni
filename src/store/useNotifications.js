import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  showLocalNotification,
} from '../lib/notifications'

let channel = null
let toastTimer = null

export const useNotifications = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  toast: null,
  panelOpen: false,

  setPanelOpen: (open) => set({ panelOpen: open }),

  showToast: (toast) => {
    if (toastTimer) window.clearTimeout(toastTimer)
    set({ toast })
    toastTimer = window.setTimeout(() => {
      set({ toast: null })
    }, 4500)
  },

  clearToast: () => {
    if (toastTimer) window.clearTimeout(toastTimer)
    set({ toast: null })
  },

  load: async () => {
    set({ loading: true })
    const items = await fetchNotifications()
    set({
      items,
      unreadCount: items.filter((n) => !n.is_read).length,
      loading: false,
    })
  },

  markRead: async (id) => {
    await markNotificationRead(id)
    set((state) => {
      const items = state.items.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      )
      return {
        items,
        unreadCount: items.filter((n) => !n.is_read).length,
      }
    })
  },

  markAllRead: async () => {
    await markAllNotificationsRead()
    set((state) => ({
      items: state.items.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },

  prepend: (notification) => {
    set((state) => {
      if (state.items.some((n) => n.id === notification.id)) return state
      const items = [notification, ...state.items]
      return {
        items,
        unreadCount: items.filter((n) => !n.is_read).length,
      }
    })
  },

  subscribe: (userId) => {
    if (!supabase || !userId) return
    get().unsubscribe()

    void get().load()

    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new
          get().prepend(row)
          get().showToast({
            title: row.title,
            body: row.body,
            link: row.link,
            id: row.id,
          })

          // Native ses / sistem bildirimi
          try {
            const audio = new Audio(
              'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2Vi4N9e3uBg4ySmJ2dnJmVkY+MioqLjI+SmJydnJmVkY+MioqLjI+SmJyd'
            )
            audio.volume = 0.35
            void audio.play().catch(() => {})
          } catch {
            /* ignore */
          }

          void showLocalNotification(row.title, row.body, {
            notification_id: row.id,
            link: row.link,
            type: row.type,
          })
        }
      )
      .subscribe()
  },

  unsubscribe: () => {
    if (channel && supabase) {
      void supabase.removeChannel(channel)
      channel = null
    }
  },
}))
