import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useNotifications } from '../store/useNotifications'

export default function NotificationToast() {
  const navigate = useNavigate()
  const { toast, clearToast, markRead } = useNotifications()

  if (!toast) return null

  async function open() {
    if (toast.id) await markRead(toast.id)
    clearToast()
    if (toast.link) navigate(toast.link)
  }

  return (
    <div className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:w-96 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] animate-[fade-in-up_0.35s_ease-out]">
      <div className="bg-white border border-[#580F1C]/30 shadow-xl rounded-sm overflow-hidden">
        <div className="h-1 bg-[#580F1C]" />
        <div className="p-3 flex gap-3">
          <button type="button" onClick={open} className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-[#580F1C] truncate">{toast.title}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{toast.body}</p>
          </button>
          <button
            type="button"
            onClick={clearToast}
            className="p-1 text-gray-400 hover:text-gray-700 shrink-0"
            aria-label="Kapat"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
