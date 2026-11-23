import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Building2, Store } from 'lucide-react'
import { useAuth } from '../store/useAuth'
import { SUPPORT_EMAIL, getPasswordResetRedirectTo } from '../lib/appConfig'
import { supabase } from '../lib/supabaseClient'
import { withTimeout } from '../lib/recoveryAuth'
import logoYuvarlak from '../assets/logo-yuvarlak.webp'

const RESET_COOLDOWN_SEC = 60
const RESET_TIMEOUT_MS = 15000
const RESET_SUCCESS_MSG =
  'Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Spam klasörünü de kontrol edin.'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function mapAuthError(err) {
  const msg = String(err?.message || '').toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('email not confirmed')) {
    return 'E-posta veya şifre hatalı. Başvuruyu admin onayladıktan sonra tekrar deneyin.'
  }
  if (msg.includes('user not found')) {
    return 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.'
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('paused') ||
    msg.includes('supabase') ||
    msg.includes('.env')
  ) {
    return 'Sunucuya bağlanılamadı, lütfen tekrar deneyin.'
  }
  return 'İşlem sırasında bir hata oluştu.'
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
  const [isExiting, setIsExiting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotNotice, setForgotNotice] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotCooldownLeft, setForgotCooldownLeft] = useState(0)
  const { signIn, signOut, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.preferredRole === 'ADMIN' || location.state?.preferredRole === 'DEALER') {
      setLoginRole(location.state.preferredRole)
    }
    if (location.state?.notice) {
      setNotice(location.state.notice)
    }
    if (location.state?.pendingBlocked) {
      setError('Hesabınız henüz onaylanmamıştır')
      void signOut()
    }
    if (location.state?.openForgot) {
      setForgotOpen(true)
      setForgotEmail((prev) => prev || '')
    }
    if (
      location.state?.notice ||
      location.state?.pendingBlocked ||
      location.state?.preferredRole ||
      location.state?.openForgot
    ) {
      navigate(location.pathname, {
        replace: true,
        state: location.state?.from ? { from: location.state.from } : {},
      })
    }
  }, [location, navigate, signOut])

  useEffect(() => {
    if (forgotCooldownLeft <= 0) return undefined
    const id = window.setInterval(() => {
      setForgotCooldownLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [forgotCooldownLeft])

  useEffect(() => {
    if (!loading && profile) {
      if (profile.status && profile.status !== 'APPROVED') {
        void signOut()
        setError('Hesabınız henüz onaylanmamıştır')
        return
      }
      const from = location.state?.from
      const fromPath =
        typeof from === 'string'
          ? from
          : from?.pathname
            ? `${from.pathname}${from.search || ''}`
            : null
      if (fromPath && fromPath !== '/login') {
        navigate(fromPath, { replace: true })
        return
      }
      const redirect = profile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard'
      navigate(redirect, { replace: true })
    }
  }, [profile, loading, navigate, signOut, location.state])

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

      const from = location.state?.from
      const fromPath =
        typeof from === 'string'
          ? from
          : from?.pathname
            ? `${from.pathname}${from.search || ''}`
            : null
      if (fromPath && fromPath !== '/login') {
        navigate(fromPath, { replace: true })
      } else {
        navigate(currentProfile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard')
      }
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBasvuruClick = (e) => {
    e.preventDefault()
    setIsExiting(true)
    window.setTimeout(() => {
      navigate('/bayi-basvuru')
    }, 300)
  }

  function openForgot() {
    setForgotOpen(true)
    setForgotError('')
    setForgotNotice('')
    setForgotEmail((prev) => prev || email || '')
  }

  function closeForgot() {
    setForgotOpen(false)
    setForgotError('')
    setForgotNotice('')
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setForgotError('')
    setForgotNotice('')

    const trimmed = String(forgotEmail || '').trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      setForgotError('Geçerli bir e-posta adresi girin.')
      return
    }

    const redirectTo = getPasswordResetRedirectTo()
    if (!redirectTo) {
      setForgotError(
        'Şifre sıfırlama için web adresi yapılandırılmamış. Lütfen tarayıcıdan deneyin veya destek ile iletişime geçin.'
      )
      return
    }

    if (!supabase) {
      setForgotError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      return
    }

    if (forgotCooldownLeft > 0) return

    setForgotSubmitting(true)
    try {
      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(trimmed, { redirectTo }),
        RESET_TIMEOUT_MS
      )

      if (resetError) {
        const status = resetError.status || resetError.code
        const msg = String(resetError.message || '').toLowerCase()
        if (
          status === 429 ||
          msg.includes('rate limit') ||
          msg.includes('too many') ||
          msg.includes('email rate limit')
        ) {
          setForgotError('Çok sık denediniz, biraz sonra tekrar deneyin.')
        } else {
          // Hesap varlığını sızdırma: ağ/sunucu hataları dışında da aynı başarı mesajı
          if (
            msg.includes('failed to fetch') ||
            msg.includes('network') ||
            msg.includes('fetch')
          ) {
            setForgotError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
          } else {
            setForgotNotice(RESET_SUCCESS_MSG)
            setForgotCooldownLeft(RESET_COOLDOWN_SEC)
          }
        }
        return
      }

      setForgotNotice(RESET_SUCCESS_MSG)
      setForgotCooldownLeft(RESET_COOLDOWN_SEC)
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('zaman aşımı')) {
        setForgotError(msg)
      } else {
        setForgotError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      }
    } finally {
      setForgotSubmitting(false)
    }
  }

  if (loading || (profile && profile.status === 'APPROVED')) {
    return (
      <div className="h-dvh min-h-screen flex items-center justify-center overflow-hidden bg-[#580F1C]">
        <p className="text-sm text-white/70">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="relative h-dvh min-h-screen bg-[#580F1C] flex items-center justify-center px-4 overflow-hidden safe-area-pad-t safe-area-pad-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <img
        src={logoYuvarlak}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] sm:w-[480px] sm:h-[480px] opacity-[0.06] pointer-events-none select-none"
      />

      <div className="relative w-full max-w-sm z-10">
        <div className="flex justify-center -mb-14 relative z-20">
          <img
            src={logoYuvarlak}
            alt="Mehmedoğlu Çiğköfte"
            className="w-30 h-30 sm:w-36 sm:h-36 rounded-full shadow-lg ring-4 ring-white object-cover animate-scale-in delay-200"
          />
        </div>

        <div className={`bg-white rounded-sm p-5 sm:p-8 pt-14 sm:pt-16 shadow-2xl ${isExiting ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}>
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
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
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
                className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
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
              className="w-full min-h-11 py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
            >
              {submitting
                ? 'Giriş yapılıyor...'
                : loginRole === 'ADMIN'
                  ? 'Dağıtıcı Girişi'
                  : 'Bayi Girişi'}
            </button>
          </form>

          <div className="mt-3 text-center">
            {!forgotOpen ? (
              <button
                type="button"
                onClick={openForgot}
                className="min-h-11 px-2 text-sm font-medium text-[#580F1C] underline underline-offset-2 hover:text-[#3d0a13] transition-colors"
              >
                Şifremi unuttum
              </button>
            ) : (
              <form
                onSubmit={handleForgotSubmit}
                noValidate
                className="text-left space-y-3 pt-2 border-t border-gray-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-700">Şifre sıfırlama</p>
                  <button
                    type="button"
                    onClick={closeForgot}
                    className="min-h-11 px-2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Kapat
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderilir. Bayi ve dağıtıcı
                  hesapları aynı akışı kullanır.
                </p>
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    E-posta
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
                    placeholder="ornek@firma.com"
                  />
                </div>

                {forgotNotice && (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
                    {forgotNotice}
                  </p>
                )}
                {forgotError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                    {forgotError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={forgotSubmitting || forgotCooldownLeft > 0}
                  className="w-full min-h-11 py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
                >
                  {forgotSubmitting
                    ? 'Gönderiliyor...'
                    : forgotCooldownLeft > 0
                      ? `Tekrar gönder (${forgotCooldownLeft} sn)`
                      : 'Sıfırlama bağlantısı gönder'}
                </button>
              </form>
            )}
          </div>

          {loginRole === 'DEALER' && (
            <p className="text-center mt-5 pt-4 border-t border-gray-100">
              <Link
                to="/bayi-basvuru"
                onClick={handleBasvuruClick}
                className="text-sm font-semibold text-[#580F1C] underline underline-offset-4 decoration-2 decoration-[#580F1C]/50 hover:decoration-[#580F1C] hover:text-[#3d0a13] transition-colors"
              >
                Bayi başvurusu yapmak için tıklayın
              </Link>
            </p>
          )}

          <div className="mt-4 space-y-2 text-center">
            <p>
              <Link
                to="/gizlilik"
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
              >
                Gizlilik Politikası
              </Link>
            </p>
            <p className="text-[11px] text-gray-400">
              Destek:{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="underline underline-offset-2 hover:text-gray-600"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
