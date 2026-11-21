import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import NotificationToast from './NotificationToast'
import { useAuth } from '../store/useAuth'
import { useNotifications } from '../store/useNotifications'
import { registerPushToken } from '../lib/notifications'

function getInitialSidebarOpen() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 768px)').matches
}

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarOpen)
  const user = useAuth((s) => s.user)
  const subscribe = useNotifications((s) => s.subscribe)
  const unsubscribe = useNotifications((s) => s.unsubscribe)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    function onChange(e) {
      setIsSidebarOpen(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!user?.id) {
      unsubscribe()
      return
    }

    subscribe(user.id)
    registerPushToken(user.id).catch(() => {})

    return () => unsubscribe()
  }, [user?.id, subscribe, unsubscribe])

  function toggleSidebar() {
    setIsSidebarOpen((open) => !open)
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col safe-area-pad-b pb-[env(safe-area-inset-bottom)] max-w-[100vw]">
      <Navbar onToggleSidebar={toggleSidebar} />

      <div className="flex flex-1 min-h-0 min-w-0 overflow-x-clip">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="flex-1 min-w-0 overflow-x-clip overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <NotificationToast />
    </div>
  )
}
