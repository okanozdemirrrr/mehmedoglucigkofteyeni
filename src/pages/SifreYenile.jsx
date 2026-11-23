import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createRecoveryClient,
  establishRecoverySession,
  withTimeout,
} from '../lib/recoveryAuth'
import { SUPPORT_EMAIL } from '../lib/appConfig'
import logoYuvarlak from '../assets/logo-yuvarlak.webp'

const MIN_LEN = 8

export default function SifreYenile() {
  const [phase, setPhase] = useState('loading') // loading | form | success | invalid
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [client] = useState(() => createRecoveryClient())

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!client) {
        if (!cancelled) setPhase('invalid')
        return
      }
      try {
        const result = await establishRecoverySession(client)
        if (cancelled) return
        if (result.ok) {
          setPhase('form')
          // Token’ları adresten temizle (geri / paylaşım riski)
          try {
            window.history.replaceState({}, '', '/sifre-yenile')
          } catch {
            /* ignore */
          }
        } else {
          setPhase('invalid')
        }
      } catch {
        if (!cancelled) setPhase('invalid')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [client])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < MIN_LEN) {
      setError(`Şifre en az ${MIN_LEN} karakter olmalı.`)
      return
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    if (!client) {
      setPhase('invalid')
      return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await withTimeout(
        client.auth.updateUser({ password }),
        15000
      )
      if (updateError) {
        const msg = String(updateError.message || '').toLowerCase()
        if (msg.includes('same password') || msg.includes('should be different')) {
          setError('Yeni şifre eskisiyle aynı olamaz.')
        } else if (msg.includes('expired') || msg.includes('session') || msg.includes('jwt')) {
          setPhase('invalid')
        } else {
          setError('Şifre güncellenemedi. Lütfen tekrar deneyin.')
        }
        return
      }

      try {
        await withTimeout(client.auth.signOut(), 10000)
      } catch {
        /* oturum zaten bitmiş olabilir */
      }
      setPhase('success')
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('zaman aşımı')) {
        setError(msg)
      } else {
        setError('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#580F1C] flex items-center justify-center px-4 py-8 safe-area-pad-t safe-area-pad-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img
            src={logoYuvarlak}
            alt="Mehmedoğlu"
            className="w-20 h-20 rounded-full ring-2 ring-white/40 object-cover"
          />
        </div>

        <div className="bg-white rounded-sm p-5 sm:p-6 shadow-xl space-y-4">
          <h1 className="text-lg font-semibold text-gray-900 text-center">Şifre yenile</h1>

          {phase === 'loading' && (
            <p className="text-sm text-gray-500 text-center py-6">Bağlantı kontrol ediliyor...</p>
          )}

          {phase === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-sm px-3 py-3">
                Şifreniz güncellendi. Uygulamaya dönüp yeni şifrenizle giriş yapabilirsiniz.
              </p>
              <Link
                to="/login"
                className="block w-full min-h-11 text-center py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
              >
                Giriş sayfasına git
              </Link>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="space-y-4">
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-3">
                Bu bağlantı geçersiz veya süresi dolmuş. Lütfen giriş ekranından yeni bir şifre
                sıfırlama bağlantısı isteyin.
              </p>
              <Link
                to="/login"
                state={{ openForgot: true }}
                className="block w-full min-h-11 text-center py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
              >
                Yeni bağlantı iste
              </Link>
              <p className="text-[11px] text-gray-400 text-center">
                Destek:{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="underline underline-offset-2 hover:text-gray-600"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          )}

          {phase === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Yeni şifrenizi girin. En az {MIN_LEN} karakter olmalıdır.
              </p>
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-gray-700 mb-1">
                  Yeni şifre
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_LEN}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
                />
              </div>
              <div>
                <label
                  htmlFor="new-password2"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Yeni şifre (tekrar)
                </label>
                <input
                  id="new-password2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={MIN_LEN}
                  className="w-full px-3 py-2.5 text-base md:text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]"
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
                {submitting ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
