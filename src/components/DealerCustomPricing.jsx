import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency } from '../utils/format'
import { StackTableWrap, stackTableClass } from './StackTable'

export default function DealerCustomPricing({ dealerId }) {
  const [products, setProducts] = useState([])
  const [customPrices, setCustomPrices] = useState({})
  const [editingPrice, setEditingPrice] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    fetchData()
  }, [dealerId])

  async function fetchData() {
    setLoading(true)

    const [productsRes, pricesRes] = await Promise.all([
      supabase.from('products').select('id, name, base_price').order('name'),
      supabase.from('dealer_prices').select('*').eq('dealer_id', dealerId),
    ])

    setProducts(productsRes.data || [])

    const priceMap = {}
    for (const price of pricesRes.data || []) {
      priceMap[price.product_id] = price.custom_price
    }
    setCustomPrices(priceMap)

    setLoading(false)
  }

  async function handleSavePrice(productId) {
    const newPrice = parseFloat(editingPrice[productId])
    if (!newPrice || newPrice < 0) {
      window.alert('Geçerli bir fiyat giriniz.')
      return
    }

    setSaving(productId)

    const { error } = await supabase
      .from('dealer_prices')
      .upsert(
        {
          dealer_id: dealerId,
          product_id: productId,
          custom_price: newPrice,
        },
        { onConflict: 'dealer_id,product_id' }
      )

    if (error) {
      window.alert(error.message)
    } else {
      setCustomPrices((prev) => ({ ...prev, [productId]: newPrice }))
      setEditingPrice((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    }

    setSaving(null)
  }

  async function handleRemovePrice(productId) {
    if (!window.confirm('Bu ürün için özel fiyatı kaldırmak istediğinize emin misiniz?')) {
      return
    }

    setSaving(productId)

    const { error } = await supabase
      .from('dealer_prices')
      .delete()
      .eq('dealer_id', dealerId)
      .eq('product_id', productId)

    if (error) {
      window.alert(error.message)
    } else {
      setCustomPrices((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    }

    setSaving(null)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Fiyatlandırma yükleniyor...</p>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-sm">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Özel Fiyatlandırma</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Bu bayiye özel ürün fiyatları tanımlayın. Tanımlı değilse standart fiyat geçerlidir.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">Sistemde ürün bulunmuyor.</p>
      ) : (
        <StackTableWrap>
          <table className={stackTableClass()}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Ürün</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">
                  Standart Fiyat
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">
                  Özel Fiyat
                </th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const hasCustomPrice = customPrices[product.id] !== undefined
                const isEditing = editingPrice[product.id] !== undefined

                return (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td data-label="Ürün" className="px-5 py-3 text-gray-900 font-medium">
                      {product.name}
                    </td>
                    <td data-label="Standart Fiyat" className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(product.base_price)}
                    </td>
                    <td data-label="Özel Fiyat" className="px-5 py-3 text-right">
                      {hasCustomPrice && !isEditing ? (
                        <span className="font-semibold text-[#580F1C]">
                          {formatCurrency(customPrices[product.id])}
                        </span>
                      ) : isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingPrice[product.id]}
                          onChange={(e) =>
                            setEditingPrice((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                          placeholder="0.00"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td data-label="" className="stack-actions px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSavePrice(product.id)}
                              disabled={saving === product.id}
                              className="text-xs px-2 py-1 bg-[#580F1C] text-white rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                            >
                              {saving === product.id ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPrice((prev) => {
                                  const next = { ...prev }
                                  delete next[product.id]
                                  return next
                                })
                              }
                              disabled={saving === product.id}
                              className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              İptal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPrice({
                                  [product.id]: hasCustomPrice
                                    ? customPrices[product.id]
                                    : product.base_price,
                                })
                              }
                              className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100"
                            >
                              {hasCustomPrice ? 'Değiştir' : 'Fiyat Tanımla'}
                            </button>
                            {hasCustomPrice && (
                              <button
                                type="button"
                                onClick={() => handleRemovePrice(product.id)}
                                disabled={saving === product.id}
                                className="text-xs px-2 py-1 border border-red-300 rounded-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {saving === product.id ? 'Siliniyor...' : 'Kaldır'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </StackTableWrap>
      )}
    </div>
  )
}
