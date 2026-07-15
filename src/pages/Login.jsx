import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile) {
      const redirect = profile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard'
      navigate(redirect, { replace: true })
    }
  }, [profile, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signIn(email, password)
      const { profile: currentProfile } = useAuth.getState()

      if (currentProfile?.role === 'ADMIN') {
        navigate('/admin/dashboard')
      } else {
        navigate('/bayi/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Giriş başarısız')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || profile) {
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
              {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center mt-5">
            <Link
              to="/bayi-basvuru"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Bayi başvurusu yapmak için tıklayın
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
