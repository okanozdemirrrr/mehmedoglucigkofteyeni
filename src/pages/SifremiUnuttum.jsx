import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPasswordResetRedirectTo, SUPPORT_EMAIL } from '../lib/appConfig'
import { supabase } from '../lib/supabaseClient'
import { withTimeout } from '../lib/recoveryAuth'
import logoYuvarlak from '../assets/logo-yuvarlak.webp'

const RESET_COOLDOWN_SEC = 60
const RESET_TIMEOUT_MS = 15000

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export default function SifremiUnuttum() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownLeft, setCooldownLeft] = useState(0)

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined
    const id = window.setInterval(() => {
      setCooldownLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownLeft])

  async function sendReset() {
    setError('')
    const trimmed = String(email || '').trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      setError('Geçerli bir e-posta adresi girin.')
      return
    }

    const redirectTo = getPasswordResetRedirectTo()
    if (!redirectTo) {
      setError(
        'Şifre sıfırlama için web adresi yapılandırılmamış. Lütfen tarayıcıdan deneyin veya destek ile iletişime geçin.'
      )
      return
    }

    if (!supabase) {
      setError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      return
    }

    if (cooldownLeft > 0) return

    setSubmitting(true)
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
          setError('Çok sık denediniz, biraz sonra tekrar deneyin.')
          return
        }
        if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
          setError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
          return
        }
        // Hesap varlığını sızdırma
        setSent(true)
        setCooldownLeft(RESET_COOLDOWN_SEC)
        return
      }

      setSent(true)
      setCooldownLeft(RESET_COOLDOWN_SEC)
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('zaman aşımı')) {
        setError(msg)
      } else {
        setError('Sunucuya bağlanılamadı, lütfen tekrar deneyin.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    void sendReset()
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
            className="w-30 h-30 sm:w-36 sm:h-36 rounded-full shadow-lg ring-4 ring-white object-cover"
          />
        </div>

        <div className="bg-white rounded-sm p-5 sm:p-8 pt-14 sm:pt-16 shadow-2xl space-y-4">
          <h1 className="text-lg font-semibold text-gray-900 text-center">Şifremi unuttum</h1>

          {!sent ? (
            <>
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Hesabınıza kayıtlı e-posta adresinizi yazın. Size şifrenizi yenileyebileceğiniz bir
                bağlantı göndereceğiz.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
                    placeholder="ornek@firma.com"
                  />
                </div>

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
                  {submitting ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
                </button>
              </form>

              <p className="text-center">
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-[#580F1C] underline underline-offset-2 hover:text-[#3d0a13] transition-colors"
                >
                  Girişe dön
                </Link>
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-sm px-3 py-3 leading-relaxed">
                E-postanızı kontrol edin. Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı
                gönderildi. Bağlantı birkaç dakika içinde gelmezse spam/gereksiz klasörünü kontrol
                edin.
              </p>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={submitting || cooldownLeft > 0}
                onClick={() => void sendReset()}
                className="w-full min-h-11 py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Gönderiliyor...'
                  : cooldownLeft > 0
                    ? `Tekrar gönder (${cooldownLeft} sn)`
                    : 'Tekrar gönder'}
              </button>

              <p className="text-center">
                <Link
                  to="/login"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-[#580F1C] underline underline-offset-2 hover:text-[#3d0a13] transition-colors"
                >
                  Girişe dön
                </Link>
              </p>
            </div>
          )}

          <p className="text-[11px] text-gray-400 text-center pt-1">
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
  )
}
