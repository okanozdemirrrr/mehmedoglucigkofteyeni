import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, X } from 'lucide-react'
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
  const buttonRef = useRef(null)
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
      const t = e.target
      if (buttonRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setPanelOpen(false)
    }

    function onKey(e) {
      if (e.key === 'Escape') setPanelOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [panelOpen, setPanelOpen])

  async function handleItemClick(n) {
    await markRead(n.id)
    setPanelOpen(false)
    if (n.link) navigate(n.link)
  }

  const panel = panelOpen
    ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/35"
            aria-hidden="true"
            onClick={() => setPanelOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Bildirimler"
            className="fixed z-[60] left-2 right-2 top-[calc(env(safe-area-inset-top)+3.75rem)] max-h-[min(70dvh,28rem)] bg-white text-gray-900 border border-gray-200 shadow-xl rounded-sm overflow-hidden sm:left-auto sm:right-3 sm:w-[22rem] sm:max-w-[calc(100vw-1.5rem)]"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 shrink-0">
                Bildirimler
              </p>
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="inline-flex items-center justify-center gap-1 min-h-11 px-2 text-[11px] text-[#580F1C] font-medium"
                >
                  <CheckCheck size={12} />
                  <span className="truncate">Tümünü okundu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="inline-flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-gray-700"
                  aria-label="Kapat"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[min(60dvh,24rem)] overscroll-contain">
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
                    className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors min-h-11 ${
                      !n.is_read ? 'bg-[#580F1C]/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm break-words ${
                          !n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#580F1C] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 break-words">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatWhen(n.created_at)}</p>
                  </button>
                ))}
            </div>
          </div>
        </>,
        document.body
      )
    : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative inline-flex items-center justify-center min-h-11 min-w-11 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
        aria-label="Bildirimler"
        aria-expanded={panelOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[#580F1C] text-[10px] font-bold leading-4 text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </>
  )
}
