import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'

const SUPPORT_EMAIL = 'destek@regonteknoloji.com'
const DEMO_EMAILS = new Set([
  'review-admin@regonteknoloji.com',
  'review-bayi@regonteknoloji.com',
])

export default function AccountSettings() {
  const { user, profile, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const email = (user?.email || profile?.email || '').toLowerCase()
  const isDemoAccount = Boolean(profile?.is_demo) || DEMO_EMAILS.has(email)

  async function handleConfirmDelete() {
    setError('')
    setDeleting(true)
    try {
      await deleteAccount()
      setConfirmOpen(false)
      navigate('/login', {
        replace: true,
        state: {
          notice: 'Hesabınız silindi.',
        },
      })
    } catch (err) {
      const msg = String(err?.message || '')
      setError(
        msg.includes('Demo') || msg.includes('inceleme')
          ? 'Demo / inceleme hesapları silinemez.'
          : 'İşlem sırasında bir hata oluştu.'
      )
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Hesap Ayarları</h1>
        <p className="text-sm text-gray-500 mt-1">
          Profil bilgileriniz ve hesap işlemleri
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4 sm:p-5 space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500">Ad Soyad</p>
          <p className="text-sm text-gray-900 mt-0.5">{profile?.full_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">E-posta</p>
          <p className="text-sm text-gray-900 mt-0.5">{user?.email || profile?.email || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Rol</p>
          <p className="text-sm text-gray-900 mt-0.5">
            {profile?.role === 'ADMIN' ? 'Dağıtıcı' : 'Bayi'}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-4 sm:p-5 space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          Uygulama destek, şikayet ve hesap silme talepleriniz için bize ulaşın:{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-[#580F1C] font-medium underline underline-offset-2 hover:text-[#3d0a13]"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-xs text-gray-400">
          <Link to="/gizlilik" className="underline underline-offset-2 hover:text-gray-600">
            Gizlilik Politikası
          </Link>
        </p>
      </div>

      <div className="bg-white border border-red-100 rounded-sm p-4 sm:p-5 space-y-3">
        <p className="text-xs font-medium text-gray-700">Tehlikeli bölge</p>
        <p className="text-xs text-gray-500">
          Hesabınızı sildiğinizde oturumunuz kapanır; kişisel verileriniz silinir veya
          anonimleştirilir. Bu işlem geri alınamaz.
        </p>
        {isDemoAccount && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
            Bu bir App Store inceleme / demo hesabıdır; güvenlik nedeniyle silinemez.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={isDemoAccount}
          onClick={() => {
            setError('')
            setConfirmOpen(true)
          }}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Hesabımı Sil
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="w-full max-w-sm bg-white rounded-sm shadow-xl border border-gray-200 p-5 space-y-4">
            <h2 id="delete-account-title" className="text-sm font-semibold text-gray-900">
              Hesabı sil
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Hesabınızı ve tüm verilerinizi silmek istediğinize emin misiniz? Bu işlem geri
              alınamaz.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Siliniyor...' : 'Evet, hesabımı sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
