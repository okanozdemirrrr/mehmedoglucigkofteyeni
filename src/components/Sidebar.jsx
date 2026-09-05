import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UtensilsCrossed,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../store/useAuth'
import logoSidebar from '../assets/logo-yuvarlak.png'

const ADMIN_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/admin/bayiler', label: 'Bayiler', Icon: Users },
  { to: '/admin/basvurular', label: 'Bayi Başvuruları', Icon: ClipboardList },
  { to: '/admin/menu', label: 'Menü Yönetimi', Icon: UtensilsCrossed },
]

const DEALER_ITEMS = [
  { to: '/bayi/dashboard', label: 'Sipariş Paneli', Icon: LayoutDashboard },
  { to: '/bayi/iade', label: 'İade / Fire', Icon: RotateCcw },
]

function linkClass(isActive) {
  return `flex items-center gap-2.5 px-3 py-2 text-sm rounded-sm transition-colors ${
    isActive
      ? 'bg-[#580F1C]/10 text-[#580F1C] font-medium'
      : 'text-gray-700 hover:bg-gray-50'
  }`
}

export default function Sidebar({ isOpen, onClose }) {
  const { profile } = useAuth()
  const location = useLocation()
  const items = profile?.role === 'ADMIN' ? ADMIN_ITEMS : DEALER_ITEMS

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 top-14 z-20 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          shrink-0 bg-white border-r border-gray-200
          transition-all duration-200 ease-out
          fixed md:static top-14 bottom-0 left-0 z-20
          ${isOpen ? 'w-56 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-r-0'}
        `}
      >
        <nav className="h-full w-56 overflow-y-auto py-3 px-2">
          <div className="pb-4 mb-4 border-b border-gray-200">
            <img
              src={logoSidebar}
              alt="Mehmedoğlu Çiğköfte"
              className="w-24 h-24 mx-auto object-contain"
            />
          </div>
          <ul className="space-y-0.5">
            {items.map((item) => {
              const isBayilerLink = item.to === '/admin/bayiler'

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={!isBayilerLink}
                    onClick={() => {
                      if (window.innerWidth < 768) onClose()
                    }}
                    className={({ isActive }) =>
                      linkClass(
                        isBayilerLink
                          ? location.pathname.startsWith('/admin/bayiler')
                          : isActive
                      )
                    }
                  >
                    <item.Icon size={15} className="shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
