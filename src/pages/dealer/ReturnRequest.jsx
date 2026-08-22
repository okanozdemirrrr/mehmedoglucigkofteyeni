import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../store/useAuth'
import { formatDate } from '../../utils/format'

const REASON_OPTIONS = [
  'Paket patlak',
  'Tarihi geçti',
  'Ürün bozuldu',
  'Yanlış ürün',
  'Fire / fire kaydı',
  'Diğer',
]

const STATUS_LABELS = {
  PENDING: 'Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
}

const STATUS_CLASS = {
  PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
  APPROVED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
}

export default function ReturnRequest() {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [requests, setRequests] = useState([])
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState(REASON_OPTIONS[0])
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (profile?.dealer_id) fetchData()
  }, [profile?.dealer_id])

  async function fetchData() {
    setLoading(true)
    const dealerId = profile.dealer_id

    const [productsRes, requestsRes] = await Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
      supabase
        .from('return_requests')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false }),
    ])

    setProducts(productsRes.data || [])
    setRequests(requestsRes.data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const product = products.find((p) => p.id === productId)
    if (!product) {
      setError('Ürün seçiniz.')
      return
    }

    const qty = parseInt(quantity, 10)
    if (!qty || qty < 1) {
      setError('Geçerli bir miktar giriniz.')
      return
    }

    const finalReason = reason === 'Diğer' ? customReason.trim() : reason
    if (!finalReason) {
      setError('Sebep giriniz.')
      return
    }

    setSubmitting(true)

    const { error: insertError } = await supabase.from('return_requests').insert({
      dealer_id: profile.dealer_id,
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      reason: finalReason,
      status: 'PENDING',
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    setProductId('')
    setQuantity('1')
    setReason(REASON_OPTIONS[0])
    setCustomReason('')
    setSuccess(true)
    setSubmitting(false)
    fetchData()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Yükleniyor...</p>
  }

  return (
    <div className="max-w-2xl">
      <Link
        to="/bayi/dashboard"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4"
      >
        <ArrowLeft size={14} />
        Panele dön
      </Link>

      <h1 className="text-lg font-semibold text-gray-900 mb-1">İade / Fire Bildir</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bozulan veya kalan ürünler için iade talebi oluşturun. Onay sonrası cari borcunuz düşer.
      </p>

      <div className="bg-white border border-gray-200 rounded-sm p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ürün</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] bg-white"
            >
              <option value="">Ürün seçin</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Miktar</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sebep</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] bg-white"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Diğer' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Açıklama</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                required
                placeholder="Sebebi yazın"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
              İade talebiniz gönderildi. Admin onayını bekliyor.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Taleplerim</h2>
        </div>

        {requests.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Henüz iade talebi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tarih</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Ürün</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Miktar</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Sebep</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Durum</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDate(req.created_at)}</td>
                    <td className="px-5 py-3 text-gray-900">{req.product_name}</td>
                    <td className="px-5 py-3 text-gray-700">{req.quantity}</td>
                    <td className="px-5 py-3 text-gray-600">{req.reason}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-sm ${STATUS_CLASS[req.status]}`}
                      >
                        {STATUS_LABELS[req.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
