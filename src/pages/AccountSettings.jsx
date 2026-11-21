import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { SUPPORT_EMAIL } from '../lib/appConfig'
import { supabase } from '../lib/supabaseClient'

const DEMO_EMAILS = new Set([
  'review-admin@regonteknoloji.com',
  'review-bayi@regonteknoloji.com',
])

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export default function AccountSettings() {
  const { user, profile, deleteAccount, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = profile?.role === 'ADMIN'
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const currentEmail = (user?.email || profile?.email || '').toLowerCase()
  const isDemoAccount = Boolean(profile?.is_demo) || DEMO_EMAILS.has(currentEmail)

  useEffect(() => {
    if (!editing) {
      setFullName(profile?.full_name || '')
      setEmail(user?.email || profile?.email || '')
    }
  }, [profile?.full_name, user?.email, profile?.email, editing])

  function startEdit() {
    setFormError('')
    setFormSuccess('')
    setFullName(profile?.full_name || '')
    setEmail(user?.email || profile?.email || '')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setFormError('')
    setFullName(profile?.full_name || '')
    setEmail(user?.email || profile?.email || '')
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    const nextName = fullName.trim()
    const nextEmail = email.trim().toLowerCase()
    const prevEmail = (user?.email || profile?.email || '').trim().toLowerCase()

    if (!nextName || nextName.length < 2) {
      setFormError('Ad soyad en az 2 karakter olmalıdır.')
      return
    }
    if (!isValidEmail(nextEmail)) {
      setFormError('Geçerli bir e-posta adresi girin.')
      return
    }
    if (!supabase || !user?.id) {
      setFormError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      return
    }

    setSaving(true)
    try {
      const nameChanged = nextName !== (profile?.full_name || '').trim()
      const emailChanged = nextEmail !== prevEmail

      if (nameChanged) {
        const { error: nameErr } = await supabase
          .from('profiles')
          .update({ full_name: nextName })
          .eq('id', user.id)
        if (nameErr) throw nameErr
      }

      let emailPendingConfirm = false
      if (emailChanged) {
        const { data: authData, error: authErr } = await supabase.auth.updateUser({
          email: nextEmail,
        })
        if (authErr) throw authErr

        const confirmedEmail = (authData?.user?.email || '').toLowerCase()
        const pendingNew = (authData?.user?.new_email || '').toLowerCase()
        emailPendingConfirm =
          Boolean(pendingNew) || (confirmedEmail && confirmedEmail !== nextEmail)

        if (!emailPendingConfirm && confirmedEmail === nextEmail) {
          const { error: emailErr } = await supabase
            .from('profiles')
            .update({ email: nextEmail })
            .eq('id', user.id)
          if (emailErr) throw emailErr
        }
      }

      await fetchProfile(user)

      if (emailPendingConfirm) {
        setFormSuccess(
          (nameChanged ? 'Ad soyad kaydedildi. ' : '') +
            'Yeni adresinize onay bağlantısı gönderildi. Onaylanana kadar eski e-posta ile giriş çalışmaya devam eder.'
        )
      } else if (emailChanged || nameChanged) {
        setFormSuccess('Hesap bilgileriniz güncellendi.')
      } else {
        setFormSuccess('Değişiklik yok.')
      }
      setEditing(false)
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        setFormError('Bu e-posta başka bir hesapta kullanılıyor.')
      } else if (
        msg.includes('rate') ||
        msg.includes('security') ||
        msg.includes('email')
      ) {
        setFormError(
          'E-posta güncellenemedi. Adresi kontrol edin veya biraz sonra tekrar deneyin.'
        )
      } else if (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('fetch')
      ) {
        setFormError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      } else {
        setFormError('İşlem sırasında bir hata oluştu.')
      }
    } finally {
      setSaving(false)
    }
  }

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
        {isAdmin && editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label htmlFor="account-full-name" className="text-xs font-medium text-gray-500">
                Ad Soyad
              </label>
              <input
                id="account-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
                className="mt-0.5 w-full min-h-11 px-3 py-2.5 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
              />
            </div>
            <div>
              <label htmlFor="account-email" className="text-xs font-medium text-gray-500">
                E-posta
              </label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-0.5 w-full min-h-11 px-3 py-2.5 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Rol</p>
              <p className="text-sm text-gray-900 mt-0.5">Dağıtıcı</p>
            </div>
            {formError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={cancelEdit}
                className="min-h-11 px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 px-4 py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        ) : (
          <>
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
            {isAdmin && (
              <button
                type="button"
                onClick={startEdit}
                className="min-h-11 w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-[#580F1C] border border-[#580F1C]/40 rounded-sm hover:bg-[#580F1C]/5 transition-colors"
              >
                Düzenle
              </button>
            )}
          </>
        )}
        {formSuccess && !editing && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
            {formSuccess}
          </p>
        )}
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
          className="w-full sm:w-auto min-h-11 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="min-h-11 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
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
