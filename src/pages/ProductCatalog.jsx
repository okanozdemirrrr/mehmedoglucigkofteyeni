import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPublicProducts } from '../lib/publicCatalog'
import ProductThumb from '../components/ProductThumb'
import logoYuvarlak from '../assets/logo-yuvarlak.png'

const SUPPORT_EMAIL = 'destek@regonteknoloji.com'

export default function ProductCatalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const { data, error: err } = await fetchPublicProducts()
      if (cancelled) return
      if (err) {
        setError('Ürünler yüklenemedi. Lütfen tekrar deneyin.')
        setProducts([])
      } else {
        setProducts(data)
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      const key = p.category_name || 'Diğer'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return Array.from(map.entries())
  }, [products])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col safe-area-pad-t safe-area-pad-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="bg-[#580F1C] text-white border-b border-[#3d0a13] shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoYuvarlak}
              alt="Mehmedoğlu"
              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/40 shrink-0"
            />
            <div className="min-w-0">
              <p className="font-black text-base tracking-widest uppercase truncate">Mehmedoğlu</p>
              <p className="text-[11px] text-white/70 tracking-wide">B2B Ürün Vitrini</p>
            </div>
          </div>
          <Link
            to="/login"
            className="shrink-0 px-3.5 py-2 text-sm font-semibold bg-white text-[#580F1C] rounded-sm hover:bg-white/90 transition-colors"
          >
            Giriş
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-gray-900">Ürünler</h1>
          <p className="text-sm text-gray-500 mt-1">
            Katalog herkese açıktır. Fiyat ve sipariş yalnızca onaylı bayilere özeldir.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-gray-500 py-12 text-center">Ürünler yükleniyor...</p>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-sm px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-sm px-4 py-10 text-center">
            <p className="text-sm text-gray-700">Şu an listelenecek ürün bulunmuyor.</p>
            <p className="text-xs text-gray-400 mt-2">
              Menü güncellendiğinde burada görünecektir.
            </p>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="space-y-8">
            {groups.map(([category, items]) => (
              <section key={category}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#580F1C] mb-3">
                  {category}
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((product) => (
                    <li key={product.id}>
                      <Link
                        to={`/urunler/${product.id}`}
                        className="block bg-white border border-gray-200 rounded-sm overflow-hidden hover:border-[#580F1C]/40 transition-colors"
                      >
                        <ProductThumb src={product.image_url} alt={product.name} className="w-full h-36" />
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-2 text-center">
          <p>
            <Link
              to="/bayi-basvuru"
              className="text-sm font-semibold text-[#580F1C] underline underline-offset-4 decoration-2 decoration-[#580F1C]/40 hover:decoration-[#580F1C]"
            >
              Bayi başvurusu yapmak için tıklayın
            </Link>
          </p>
          <p>
            <Link
              to="/gizlilik"
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
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
      </footer>
    </div>
  )
}
