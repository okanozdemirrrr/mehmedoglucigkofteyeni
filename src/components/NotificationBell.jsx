import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '../store/useNotifications'

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const {
    items,
    unreadCount,
    panelOpen,
    setPanelOpen,
    markRead,
    markAllRead,
    loading,
  } = useNotifications()

  useEffect(() => {
    if (!panelOpen) return

    function onDocClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [panelOpen, setPanelOpen])

  async function handleItemClick(n) {
    await markRead(n.id)
    setPanelOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
        aria-label="Bildirimler"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[#580F1C] text-[10px] font-bold leading-4 text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="absolute right-0 mt-2 w-[min(92vw,22rem)] bg-white text-gray-900 border border-gray-200 shadow-lg rounded-sm z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
              Bildirimler
            </p>
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 text-[11px] text-[#580F1C] font-medium hover:underline"
            >
              <CheckCheck size={12} />
              Tümünü Okundu İşaretle
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">Yükleniyor...</p>
            )}

            {!loading && items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-400">
                Henüz bildirim yok
              </p>
            )}

            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.is_read ? 'bg-[#580F1C]/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-xs ${
                        !n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                      }`}
                    >
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#580F1C] shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatWhen(n.created_at)}</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
