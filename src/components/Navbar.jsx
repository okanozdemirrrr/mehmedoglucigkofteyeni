import { useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../store/useAuth'
import NotificationBell from './NotificationBell'

export default function Navbar({ onToggleSidebar }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/urunler', { replace: true })
  }

  return (
    <header
      className="sticky top-0 bg-[#580F1C] text-white border-b border-[#3d0a13] shrink-0 z-30 safe-area-pad-t pt-[env(safe-area-inset-top)]"
    >
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 max-w-[100vw]">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex items-center justify-center min-h-11 min-w-11 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-sm transition-colors shrink-0"
            aria-label="Menüyü aç/kapat"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-baseline min-w-0 truncate">
            <span className="text-white font-black text-sm sm:text-xl tracking-widest uppercase truncate">
              Mehmedoğlu
            </span>
            <span className="text-gray-300 font-light text-xs sm:text-sm ml-1 sm:ml-2 tracking-widest shrink-0">
              B2B
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
          <NotificationBell />
          <span className="text-xs text-white/70 hidden sm:block max-w-[10rem] truncate">
            {profile?.full_name}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-2 sm:px-3 text-xs text-white/70 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden xs:inline sm:inline">Çıkış</span>
          </button>
        </div>
      </div>
    </header>
  )
}
