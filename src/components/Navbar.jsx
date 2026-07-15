import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Users } from 'lucide-react'
import { useAuth } from '../store/useAuth'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isAdmin = profile?.role === 'ADMIN'

  return (
    <header className="bg-[#580F1C] text-white border-b border-[#3d0a13]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold tracking-wide uppercase">
            Mehmedoğlu Çiğköfte
          </span>
          <nav className="hidden sm:flex items-center gap-1">
            {isAdmin ? (
              <>
                <NavLink
                  to="/admin/dashboard"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <LayoutDashboard size={14} />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/admin/bayiler"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Users size={14} />
                  Bayiler
                </NavLink>
              </>
            ) : (
              <NavLink
                to="/bayi/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <LayoutDashboard size={14} />
                Sipariş Paneli
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-white/70 hidden sm:block">
            {profile?.full_name}
          </span>
          <button
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
