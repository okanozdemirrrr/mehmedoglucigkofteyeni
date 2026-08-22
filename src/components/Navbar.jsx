import { useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../store/useAuth'

export default function Navbar({ onToggleSidebar }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="bg-[#580F1C] text-white border-b border-[#3d0a13] shrink-0 z-30">
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
            aria-label="Menüyü aç/kapat"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold tracking-wide uppercase truncate">
            Mehmedoğlu Çiğköfte
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs text-white/70 hidden sm:block">
            {profile?.full_name}
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/70 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Çıkış
          </button>
        </div>
      </div>
    </header>
  )
}
