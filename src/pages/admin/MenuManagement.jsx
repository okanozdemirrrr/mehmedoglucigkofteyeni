import { useEffect, useRef, useState } from 'react'
import { Trash2, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency } from '../../utils/format'
import { StackTableWrap, stackTableClass } from '../../components/StackTable'
import ProductThumb from '../../components/ProductThumb'
import { useNotifications } from '../../store/useNotifications'
import {
  prepareProductImage,
  uploadProductImage,
  removeProductImageFile,
} from '../../lib/productImages'

const SPICINESS_MODIFIER = [
  { key: 'spiciness', label: 'Acılık', required: true, options: ['Acılı', 'Acısız'] },
]

const emptyProductForm = {
  name: '',
  base_price: '',
  is_active: true,
  requires_spiciness: false,
}

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

function productHasSpiciness(product) {
  const mods = product?.modifiers_jsonb
  if (!Array.isArray(mods)) return false
  return mods.some((m) => m.key === 'spiciness' || m.label === 'Acılık')
}

function ImagePicker({ previewUrl, onFile, onClear, disabled, inputId }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">Ürün Görseli (isteğe bağlı)</label>
      <div className="flex flex-wrap items-start gap-3">
        <ProductThumb
          src={previewUrl}
          alt="Önizleme"
          className="w-24 h-24 shrink-0"
          rounded
        />
        <div className="flex flex-col gap-2 min-w-0">
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              void onFile(file)
              e.target.value = ''
            }}
            className="block w-full max-w-xs min-h-11 text-xs text-gray-600 file:mr-3 file:min-h-11 file:py-2 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-medium file:bg-[#580F1C]/10 file:text-[#580F1C] hover:file:bg-[#580F1C]/15"
          />
          <p className="text-[10px] text-gray-400">JPG / PNG / WEBP · en fazla 5 MB</p>
          {previewUrl && (
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="self-start min-h-11 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Görseli kaldır
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MenuManagement() {
  const showToast = useNotifications((s) => s.showToast)
  const editPanelRef = useRef(null)
  const editNameRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [categoryName, setCategoryName] = useState('')
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  const [productForm, setProductForm] = useState(emptyProductForm)
  const [createImageFile, setCreateImageFileState] = useState(null)
  const [createPreview, setCreatePreview] = useState(null)
  const [productSubmitting, setProductSubmitting] = useState(false)
  const [productError, setProductError] = useState('')

  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(emptyProductForm)
  const [editImageFile, setEditImageFileState] = useState(null)
  const [editPreview, setEditPreview] = useState(null)
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(p.name || '')
        .toLowerCase()
        .includes(q) ||
      String(p.product_code || '')
        .toLowerCase()
        .includes(q)
    )
  })

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

  useEffect(() => {
    return () => {
      if (createPreview?.startsWith('blob:')) URL.revokeObjectURL(createPreview)
      if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    }
  }, [createPreview, editPreview])

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
    let { data, error } = await supabase
      .from('products')
      .select('id, name, product_code, base_price, is_active, category_id, image_url, modifiers_jsonb')
      .eq('category_id', categoryId)
      .order('name')

    // Migration henüz uygulanmadıysa product_code olmadan yükle
    if (error && /product_code|column/i.test(error.message || '')) {
      const fallback = await supabase
        .from('products')
        .select('id, name, base_price, is_active, category_id, image_url, modifiers_jsonb')
        .eq('category_id', categoryId)
        .order('name')
      data = fallback.data
    }

    setProducts(data || [])
  }

  async function setCreateFile(file) {
    setProductError('')
    if (!file) {
      if (createPreview?.startsWith('blob:')) URL.revokeObjectURL(createPreview)
      setCreateImageFileState(null)
      setCreatePreview(null)
      return
    }
    try {
      await prepareProductImage(file)
      if (createPreview?.startsWith('blob:')) URL.revokeObjectURL(createPreview)
      setCreateImageFileState(file)
      setCreatePreview(URL.createObjectURL(file))
    } catch (err) {
      setProductError(err?.message || 'Görsel seçilemedi.')
    }
  }

  function clearCreateImage() {
    void setCreateFile(null)
  }

  function openEdit(product) {
    if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    setEditing(product)
    setEditForm({
      name: product.name || '',
      base_price: String(product.base_price ?? ''),
      is_active: Boolean(product.is_active),
      requires_spiciness: productHasSpiciness(product),
    })
    setEditImageFileState(null)
    setEditPreview(product.image_url || null)
    setEditRemoveImage(false)
    setEditError('')
    showToast({
      title: 'Düzenleme',
      body: 'Ürünü düzenleme kutusu aşağıda açıldı',
    })
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Odak ver ama iOS klavyeyi zorla açma (readOnly kısa süreli)
        const input = editNameRef.current
        if (input) {
          const prev = input.readOnly
          input.readOnly = true
          input.focus({ preventScroll: true })
          window.setTimeout(() => {
            input.readOnly = prev
          }, 50)
        }
      }, 80)
    })
  }

  function closeEdit() {
    if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    setEditing(null)
    setEditImageFileState(null)
    setEditPreview(null)
    setEditRemoveImage(false)
    setEditError('')
  }

  async function setEditFile(file) {
    setEditError('')
    if (!file) {
      if (editPreview?.startsWith('blob:') && editImageFile) {
        URL.revokeObjectURL(editPreview)
      }
      setEditImageFileState(null)
      setEditRemoveImage(false)
      setEditPreview(editing?.image_url || null)
      return
    }
    try {
      await prepareProductImage(file)
      if (editPreview?.startsWith('blob:') && editImageFile) {
        URL.revokeObjectURL(editPreview)
      }
      setEditImageFileState(file)
      setEditRemoveImage(false)
      setEditPreview(URL.createObjectURL(file))
    } catch (err) {
      setEditError(err?.message || 'Görsel seçilemedi.')
    }
  }

  function clearEditImage() {
    if (editPreview?.startsWith('blob:')) URL.revokeObjectURL(editPreview)
    setEditImageFileState(null)
    setEditPreview(null)
    setEditRemoveImage(true)
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

    const { data: created, error } = await supabase
      .from('products')
      .insert({
        name: productForm.name.trim(),
        base_price: price,
        is_active: productForm.is_active,
        category_id: selectedCategoryId,
        modifiers_jsonb: productForm.requires_spiciness ? SPICINESS_MODIFIER : [],
      })
      .select('id')
      .single()

    if (error) {
      setProductError(error.message)
      setProductSubmitting(false)
      return
    }

    if (createImageFile && created?.id) {
      try {
        const imageUrl = await uploadProductImage(created.id, createImageFile)
        const { error: imgErr } = await supabase
          .from('products')
          .update({ image_url: imageUrl })
          .eq('id', created.id)
        if (imgErr) throw imgErr
      } catch (err) {
        setProductError(
          err?.message ||
            'Ürün kaydedildi ancak görsel yüklenemedi. Düzenle ile tekrar deneyebilirsiniz.'
        )
        setProductSubmitting(false)
        setProductForm(emptyProductForm)
        clearCreateImage()
        fetchProducts(selectedCategoryId)
        return
      }
    }

    setProductForm(emptyProductForm)
    clearCreateImage()
    fetchProducts(selectedCategoryId)
    setProductSubmitting(false)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editing) return

    setEditError('')
    setEditSubmitting(true)

    const price = parseFloat(editForm.base_price)
    if (!price || price <= 0) {
      setEditError('Geçerli bir fiyat girin.')
      setEditSubmitting(false)
      return
    }

    let nextImageUrl = editing.image_url || null
    const previousUrl = editing.image_url || null

    try {
      if (editRemoveImage && !editImageFile) {
        await removeProductImageFile(previousUrl)
        nextImageUrl = null
      } else if (editImageFile) {
        nextImageUrl = await uploadProductImage(editing.id, editImageFile)
        if (previousUrl && previousUrl !== nextImageUrl) {
          await removeProductImageFile(previousUrl)
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: editForm.name.trim(),
          base_price: price,
          is_active: editForm.is_active,
          category_id: selectedCategoryId,
          modifiers_jsonb: editForm.requires_spiciness ? SPICINESS_MODIFIER : [],
          image_url: nextImageUrl,
        })
        .eq('id', editing.id)

      if (error) throw error

      closeEdit()
      fetchProducts(selectedCategoryId)
    } catch (err) {
      setEditError(err?.message || 'İşlem sırasında bir hata oluştu.')
    } finally {
      setEditSubmitting(false)
    }
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

    await removeProductImageFile(product.image_url)
    if (editing?.id === product.id) closeEdit()
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
            {categoryError && <p className="text-xs text-red-600">{categoryError}</p>}
            <button
              type="submit"
              disabled={categorySubmitting}
              className="w-full py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
            >
              {categorySubmitting ? 'Ekleniyor...' : 'Kategori Ekle'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="px-5 py-4 border-b border-gray-200 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedCategory ? `${selectedCategory.name} — Ürünler` : 'Kategori Seçin'}
              </h2>
              {selectedCategoryId && products.length > 0 && (
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Ürün adı veya kodu ara…"
                  className="w-full min-h-11 px-3 py-2.5 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                />
              )}
            </div>

            {!selectedCategoryId ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Ürün eklemek için sol taraftan bir kategori seçin.
              </p>
            ) : products.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Bu kategoride henüz ürün yok.
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Aramanızla eşleşen ürün yok.
              </p>
            ) : (
              <StackTableWrap>
                <table className={stackTableClass()}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">
                        Görsel
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">
                        Kod
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">
                        Ürün
                      </th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">
                        Fiyat
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">
                        Durum
                      </th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td data-label="Görsel" className="px-5 py-3">
                          <ProductThumb
                            src={p.image_url}
                            alt={p.name}
                            className="w-12 h-12"
                            rounded
                          />
                        </td>
                        <td data-label="Kod" className="px-5 py-3 text-xs font-mono text-gray-600">
                          {p.product_code || '—'}
                        </td>
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
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Düzenle"
                              onClick={() => openEdit(p)}
                              className="inline-flex items-center justify-center min-h-11 min-w-11 p-1.5 text-gray-400 hover:text-[#580F1C] transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              title="Ürünü sil"
                              onClick={() => handleDeleteProduct(p)}
                              className="inline-flex items-center justify-center min-h-11 min-w-11 p-1.5 text-gray-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StackTableWrap>
            )}
          </div>

          {editing && (
            <div
              ref={editPanelRef}
              className="bg-white border border-gray-200 rounded-sm p-5 scroll-mt-[calc(env(safe-area-inset-top)+5.5rem)]"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Ürünü Düzenle</h3>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex items-center justify-center min-h-11 min-w-11 p-1 text-gray-400 hover:text-gray-700"
                  aria-label="Kapat"
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ürün Kodu</label>
                  <input
                    type="text"
                    value={editing.product_code || '—'}
                    readOnly
                    tabIndex={-1}
                    className="w-full min-h-11 px-3 py-2.5 text-base font-mono bg-gray-50 text-gray-600 border border-gray-200 rounded-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ürün Adı *</label>
                  <input
                    ref={editNameRef}
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full min-h-11 px-3 py-2.5 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Baz Fiyat (₺) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.base_price}
                    onChange={(e) => setEditForm((f) => ({ ...f, base_price: e.target.value }))}
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
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="rounded-sm border-gray-300"
                    />
                    Aktif ürün
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.requires_spiciness}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, requires_spiciness: e.target.checked }))
                      }
                      className="rounded-sm border-gray-300"
                    />
                    Acılık seçeneği zorunlu (Acılı / Acısız)
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <ImagePicker
                    inputId="edit-product-image"
                    previewUrl={editPreview}
                    onFile={setEditFile}
                    onClear={clearEditImage}
                    disabled={editSubmitting}
                  />
                </div>
                {editError && (
                  <p className="sm:col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                    {editError}
                  </p>
                )}
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                  >
                    {editSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                  <button
                    type="button"
                    disabled={editSubmitting}
                    onClick={closeEdit}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                </div>
              </form>
            </div>
          )}

          {selectedCategoryId && (
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Yeni Ürün Ekle</h3>
              <form
                onSubmit={handleCreateProduct}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ürün Kodu</label>
                  <input
                    type="text"
                    value="Otomatik atanır (URN-####)"
                    readOnly
                    tabIndex={-1}
                    className="w-full min-h-11 px-3 py-2.5 text-base font-mono bg-gray-50 text-gray-500 border border-gray-200 rounded-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ürün Adı *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full min-h-11 px-3 py-2.5 text-base border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Baz Fiyat (₺) *
                  </label>
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
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, is_active: e.target.checked }))
                      }
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

                <div className="sm:col-span-2">
                  <ImagePicker
                    inputId="create-product-image"
                    previewUrl={createPreview}
                    onFile={setCreateFile}
                    onClear={clearCreateImage}
                    disabled={productSubmitting}
                  />
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
