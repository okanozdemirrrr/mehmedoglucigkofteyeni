import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency } from '../../utils/format'
import { StackTableWrap, stackTableClass } from '../../components/StackTable'

const SPICINESS_MODIFIER = [
  { key: 'spiciness', label: 'Acılık', required: true, options: ['Acılı', 'Acısız'] },
]

function isForeignKeyError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === '23503' ||
    msg.includes('foreign key') ||
    msg.includes('violates foreign key') ||
    msg.includes('order_items')
  )
}

export default function MenuManagement() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [categoryName, setCategoryName] = useState('')
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  const [productForm, setProductForm] = useState({
    name: '',
    base_price: '',
    is_active: true,
    requires_spiciness: false,
  })
  const [productSubmitting, setProductSubmitting] = useState(false)
  const [productError, setProductError] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      fetchProducts(selectedCategoryId)
    } else {
      setProducts([])
    }
  }, [selectedCategoryId])

  async function fetchCategories() {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('id, name, sort_order')
      .order('sort_order')

    const list = data || []
    setCategories(list)

    if (list.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(list[0].id)
    }

    setLoading(false)
  }

  async function fetchProducts(categoryId) {
    const { data } = await supabase
      .from('products')
      .select('id, name, base_price, is_active, category_id')
      .eq('category_id', categoryId)
      .order('name')

    setProducts(data || [])
  }

  async function handleCreateCategory(e) {
    e.preventDefault()
    setCategoryError('')
    setCategorySubmitting(true)

    const maxSort = categories.reduce((max, c) => Math.max(max, c.sort_order), 0)

    const { data, error } = await supabase
      .from('categories')
      .insert({ name: categoryName.trim(), sort_order: maxSort + 1 })
      .select('id')
      .single()

    if (error) {
      setCategoryError(error.message)
    } else {
      setCategoryName('')
      await fetchCategories()
      if (data?.id) setSelectedCategoryId(data.id)
    }

    setCategorySubmitting(false)
  }

  async function handleDeleteCategory(e, category) {
    e.stopPropagation()

    if (!window.confirm(`"${category.name}" kategorisini silmek istediğinize emin misiniz?`)) {
      return
    }

    const { count, error: countError } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category.id)

    if (countError) {
      window.alert(countError.message)
      return
    }

    if ((count || 0) > 0) {
      window.alert(
        'Bu kategoride ürünler var. Silebilmek için önce içindeki ürünleri silmeli veya başka kategoriye taşımalısınız.'
      )
      return
    }

    const { error } = await supabase.from('categories').delete().eq('id', category.id)

    if (error) {
      window.alert(error.message)
      return
    }

    if (selectedCategoryId === category.id) {
      setSelectedCategoryId(null)
    }
    await fetchCategories()
  }

  async function handleCreateProduct(e) {
    e.preventDefault()
    if (!selectedCategoryId) return

    setProductError('')
    setProductSubmitting(true)

    const price = parseFloat(productForm.base_price)
    if (!price || price <= 0) {
      setProductError('Geçerli bir fiyat girin.')
      setProductSubmitting(false)
      return
    }

    const { error } = await supabase.from('products').insert({
      name: productForm.name.trim(),
      base_price: price,
      is_active: productForm.is_active,
      category_id: selectedCategoryId,
      modifiers_jsonb: productForm.requires_spiciness ? SPICINESS_MODIFIER : [],
    })

    if (error) {
      setProductError(error.message)
    } else {
      setProductForm({ name: '', base_price: '', is_active: true, requires_spiciness: false })
      fetchProducts(selectedCategoryId)
    }

    setProductSubmitting(false)
  }

  async function handleDeleteProduct(product) {
    if (!window.confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)) {
      return
    }

    const { count, error: usageError } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', product.id)

    if (usageError) {
      window.alert(usageError.message)
      return
    }

    if ((count || 0) > 0) {
      window.alert(
        "Bu ürün geçmiş siparişlerde kullanıldığı için silinemez! Raporların bozulmaması için ürünü 'Pasif' duruma getirebilirsiniz."
      )
      return
    }

    const { error } = await supabase.from('products').delete().eq('id', product.id)

    if (error) {
      if (isForeignKeyError(error)) {
        window.alert(
          "Bu ürün geçmiş siparişlerde kullanıldığı için silinemez! Raporların bozulmaması için ürünü 'Pasif' duruma getirebilirsiniz."
        )
      } else {
        window.alert(error.message)
      }
      return
    }

    fetchProducts(selectedCategoryId)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Menü yükleniyor...</p>
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Menü Yönetimi</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Kategoriler */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Kategoriler</h2>
          </div>

          {categories.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">Henüz kategori yok.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <div
                    className={`group flex items-center gap-1 transition-colors ${
                      selectedCategoryId === cat.id
                        ? 'bg-[#580F1C]/5 border-l-2 border-[#580F1C]'
                        : 'hover:bg-gray-50 border-l-2 border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`flex-1 min-w-0 text-left px-5 py-3 text-sm ${
                        selectedCategoryId === cat.id
                          ? 'text-[#580F1C] font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                    <button
                      type="button"
                      title="Kategoriyi sil"
                      onClick={(e) => handleDeleteCategory(e, cat)}
                      className="shrink-0 mr-3 p-1.5 text-gray-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleCreateCategory} className="p-5 border-t border-gray-200 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Yeni Kategori
            </p>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
              placeholder="Örn: Çiğköfte"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
            />
            {categoryError && (
              <p className="text-xs text-red-600">{categoryError}</p>
            )}
            <button
              type="submit"
              disabled={categorySubmitting}
              className="w-full py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
            >
              {categorySubmitting ? 'Ekleniyor...' : 'Kategori Ekle'}
            </button>
          </form>
        </div>

        {/* Sağ: Ürünler */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedCategory ? `${selectedCategory.name} — Ürünler` : 'Kategori Seçin'}
              </h2>
            </div>

            {!selectedCategoryId ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Ürün eklemek için sol taraftan bir kategori seçin.
              </p>
            ) : products.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Bu kategoride henüz ürün yok.
              </p>
            ) : (
              <StackTableWrap>
                <table className={stackTableClass()}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Ürün</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Fiyat</th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Durum</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td data-label="Ürün" className="px-5 py-3 text-gray-900 font-medium">
                          {p.name}
                        </td>
                        <td data-label="Fiyat" className="px-5 py-3 text-right text-gray-700">
                          {formatCurrency(p.base_price)}
                        </td>
                        <td data-label="Durum" className="px-5 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs border rounded-sm ${
                              p.is_active
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {p.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </td>
                        <td data-label="" className="stack-actions px-5 py-3 text-right">
                          <button
                            type="button"
                            title="Ürünü sil"
                            onClick={() => handleDeleteProduct(p)}
                            className="inline-flex p-1.5 text-gray-300 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StackTableWrap>
            )}
          </div>

          {selectedCategoryId && (
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Yeni Ürün Ekle</h3>
              <form onSubmit={handleCreateProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ürün Adı *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Baz Fiyat (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={productForm.base_price}
                    onChange={(e) => setProductForm((f) => ({ ...f, base_price: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) => setProductForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="rounded-sm border-gray-300"
                    />
                    Aktif ürün
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.requires_spiciness}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, requires_spiciness: e.target.checked }))
                      }
                      className="rounded-sm border-gray-300"
                    />
                    Acılık seçeneği zorunlu (Acılı / Acısız)
                  </label>
                </div>

                {productError && (
                  <p className="sm:col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                    {productError}
                  </p>
                )}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={productSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                  >
                    {productSubmitting ? 'Kaydediliyor...' : 'Ürün Ekle'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
