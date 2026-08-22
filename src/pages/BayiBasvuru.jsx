import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const emptyForm = {
  full_name: '',
  age: '',
  city: '',
  district: '',
  tax_no: '',
  phone: '',
  email: '',
  password: '',
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] focus:ring-1 focus:ring-[#580F1C]'

export default function BayiBasvuru() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const age = parseInt(form.age, 10)
    if (!age || age < 18 || age > 100) {
      setError('Geçerli bir yaş giriniz (18+).')
      setSubmitting(false)
      return
    }

    if (form.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      setSubmitting(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            role: 'DEALER',
            status: 'PENDING',
            full_name: form.full_name.trim(),
            age: String(age),
            city: form.city.trim(),
            district: form.district.trim(),
            tax_no: form.tax_no.trim(),
            phone: form.phone.trim(),
          },
        },
      })

      if (signUpError) throw signUpError

      if (!data.user) {
        throw new Error('Kayıt oluşturulamadı. Lütfen tekrar deneyin.')
      }

      // Otomatik oturumu kapat — onay gelmeden panele girmesin
      await supabase.auth.signOut()

      setSuccess(true)
      setForm(emptyForm)

      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            notice:
              'Başvurunuz alındı. Yöneticiler onayladıktan sonra giriş yapabilirsiniz.',
          },
        })
      }, 1800)
    } catch (err) {
      setError(err.message || 'Başvuru gönderilemedi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-sm p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6"
          >
            <ArrowLeft size={14} />
            Giriş sayfasına dön
          </Link>

          <h1 className="text-lg font-semibold text-gray-900 mb-1">Bayi Başvurusu</h1>
          <p className="text-sm text-gray-500 mb-6">
            Bilgilerinizi doldurun. Yönetici onayından sonra sisteme giriş yapabilirsiniz.
          </p>

          {success ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-3">
                Başvurunuz alındı. Yöneticiler onayladıktan sonra giriş yapabilirsiniz.
              </p>
              <p className="text-xs text-gray-400 text-center">Giriş ekranına yönlendiriliyorsunuz...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">İsim Soyisim *</label>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Yaş *</label>
                  <input
                    name="age"
                    type="number"
                    min="18"
                    max="100"
                    value={form.age}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vergi No *</label>
                  <input
                    name="tax_no"
                    value={form.tax_no}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">İl *</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">İlçe *</label>
                  <input
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">İletişim Numarası *</label>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="05xx xxx xx xx"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-posta *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Şifre *</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className={inputClass}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Şifreniz güvenli saklanır; yöneticiler şifrenizi göremez.
                </p>
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
                {submitting ? 'Gönderiliyor...' : 'Başvuru Gönder'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
