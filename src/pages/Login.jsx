import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Building2, Store } from 'lucide-react'
import { useAuth } from '../store/useAuth'

function mapAuthError(err) {
  const msg = String(err?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials')) {
    return 'E-posta veya şifre hatalı. Başvuruyu admin onayladıktan sonra tekrar deneyin.'
  }
  if (msg.includes('email not confirmed')) {
    return 'E-posta veya şifre hatalı. Başvuruyu admin onayladıktan sonra tekrar deneyin.'
  }
  if (msg.includes('user not found')) {
    return 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.'
  }
  return err?.message || 'Giriş başarısız'
}

const ROLES = [
  {
    id: 'ADMIN',
    label: 'Dağıtıcı',
    description: 'Merkez / yönetim paneli',
    Icon: Building2,
  },
  {
    id: 'DEALER',
    label: 'Bayi',
    description: 'Sipariş ve cari paneli',
    Icon: Store,
  },
]

export default function Login() {
  const [loginRole, setLoginRole] = useState('DEALER')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signOut, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice)
      navigate(location.pathname, { replace: true, state: {} })
    }
    if (location.state?.pendingBlocked) {
      setError('Hesabınız henüz onaylanmamıştır')
      void signOut()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate, signOut])

  useEffect(() => {
    if (!loading && profile) {
      if (profile.status && profile.status !== 'APPROVED') {
        void signOut()
        setError('Hesabınız henüz onaylanmamıştır')
        return
      }
      const redirect = profile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard'
      navigate(redirect, { replace: true })
    }
  }, [profile, loading, navigate, signOut])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    try {
      await signIn(email, password)
      const { profile: currentProfile } = useAuth.getState()

      if (!currentProfile?.role) {
        await signOut()
        setError('Profil bulunamadı. Yöneticiyle iletişime geçin.')
        return
      }

      if (currentProfile.status && currentProfile.status !== 'APPROVED') {
        await signOut()
        setError('Hesabınız henüz onaylanmamıştır')
        return
      }

      if (currentProfile.role !== loginRole) {
        await signOut()
        setError(
          loginRole === 'ADMIN'
            ? 'Bu hesap dağıtıcı (yönetim) yetkisine sahip değil. Bayi olarak giriş yapmayı deneyin.'
            : 'Bu hesap bayi yetkisine sahip değil. Dağıtıcı olarak giriş yapmayı deneyin.'
        )
        return
      }

      navigate(currentProfile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard')
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || (profile && profile.status === 'APPROVED')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-sm p-8">
          <h1 className="text-center text-lg font-semibold text-[#580F1C] tracking-wide uppercase mb-1">
            Mehmedoğlu Çiğköfte
          </h1>
          <p className="text-center text-xs text-gray-500 mb-6">
            Kurumsal Sipariş Platformu
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="block text-xs font-medium text-gray-700 mb-2">Giriş tipi</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ id, label, description, Icon }) => {
                  const selected = loginRole === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setLoginRole(id)
                        setError('')
                      }}
                      className={`flex flex-col items-start gap-1 px-3 py-3 text-left border rounded-sm transition-colors ${
                        selected
                          ? 'border-[#580F1C] bg-[#580F1C]/5 text-[#580F1C]'
                          : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <Icon size={16} className={selected ? 'text-[#580F1C]' : 'text-gray-400'} />
                      <span className="text-sm font-medium">{label}</span>
                      <span className={`text-[10px] leading-tight ${selected ? 'text-[#580F1C]/80' : 'text-gray-400'}`}>
                        {description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
                placeholder="ornek@firma.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
              />
            </div>

            {notice && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
                {notice}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
            >
              {submitting
                ? 'Giriş yapılıyor...'
                : loginRole === 'ADMIN'
                  ? 'Dağıtıcı Girişi'
                  : 'Bayi Girişi'}
            </button>
          </form>

          {loginRole === 'DEALER' && (
            <p className="text-center mt-5">
              <Link
                to="/bayi-basvuru"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Bayi başvurusu yapmak için tıklayın
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
