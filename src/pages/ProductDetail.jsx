import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchPublicProduct } from '../lib/publicCatalog'
import { useAuth } from '../store/useAuth'
import ProductThumb from '../components/ProductThumb'

export default function ProductDetail() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const { data, error: err } = await fetchPublicProduct(productId)
      if (cancelled) return
      if (err || !data) {
        setError('Ürün bulunamadı veya artık listede değil.')
        setProduct(null)
      } else {
        setProduct(data)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [productId])

  function handleOrderClick() {
    const approved = user && profile?.status === 'APPROVED'
    if (approved && profile.role === 'DEALER') {
      navigate('/bayi/dashboard')
      return
    }
    if (approved && profile.role === 'ADMIN') {
      navigate('/admin/dashboard')
      return
    }
    navigate('/login', {
      state: {
        from: location,
        notice: 'Sipariş vermek için bayi hesabınızla giriş yapın.',
        preferredRole: 'DEALER',
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col safe-area-pad-t safe-area-pad-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="bg-[#580F1C] text-white border-b border-[#3d0a13] shrink-0">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link
            to="/urunler"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft size={16} />
            Ürünler
          </Link>
          <Link
            to="/login"
            className="px-3 py-1.5 text-xs font-semibold bg-white text-[#580F1C] rounded-sm hover:bg-white/90"
          >
            Giriş
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5">
        {(loading || authLoading) && (
          <p className="text-sm text-gray-500 py-12 text-center">Yükleniyor...</p>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-sm px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && product && (
          <article className="bg-white border border-gray-200 rounded-sm overflow-hidden">
            <ProductThumb
              src={product.image_url}
              alt={product.name}
              className="w-full h-56"
            />

            <div className="p-5 space-y-3">
              {product.category_name && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#580F1C]">
                  {product.category_name}
                </p>
              )}
              <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
              <p className="text-xs text-gray-400 pt-1">
                Fiyatlar ve sipariş yalnızca onaylı bayi hesabıyla görüntülenir.
              </p>

              <button
                type="button"
                onClick={handleOrderClick}
                className="w-full mt-2 py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
              >
                Sipariş ver
              </button>
            </div>
          </article>
        )}
      </main>
    </div>
  )
}
