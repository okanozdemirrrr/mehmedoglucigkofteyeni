import { useEffect, useState, useMemo } from 'react'
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../store/useAuth'
import { formatCurrency, formatDate } from '../../utils/format'

export default function BayiDashboard() {
  const { profile } = useAuth()
  const [balance, setBalance] = useState(0)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [products, setProducts] = useState([])
  const [dealerPrices, setDealerPrices] = useState({})
  const [cart, setCart] = useState([])
  const [selections, setSelections] = useState({})
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  useEffect(() => {
    if (profile?.dealer_id) {
      fetchDashboardData()
    }
  }, [profile?.dealer_id])

  async function fetchDashboardData() {
    setLoading(true)
    const dealerId = profile.dealer_id

    const [txRes, productsRes, pricesRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('dealer_prices')
        .select('product_id, custom_price')
        .eq('dealer_id', dealerId),
    ])

    const transactions = txRes.data || []
    const bal = transactions.reduce((sum, tx) => {
      return tx.transaction_type === 'DEBT'
        ? sum + Number(tx.amount)
        : sum - Number(tx.amount)
    }, 0)
    setBalance(bal)

    const receipt = transactions.find((tx) => tx.transaction_type === 'RECEIPT')
    setLastReceipt(receipt || null)

    setProducts(productsRes.data || [])

    const priceMap = {}
    for (const p of pricesRes.data || []) {
      priceMap[p.product_id] = Number(p.custom_price)
    }
    setDealerPrices(priceMap)
    setLoading(false)
  }

  function getProductPrice(product) {
    return dealerPrices[product.id] ?? Number(product.base_price)
  }

  function getRequiredModifiers(product) {
    const modifiers = product.modifiers_jsonb || []
    return Array.isArray(modifiers) ? modifiers.filter((m) => m.required) : []
  }

  function isSelectionComplete(product) {
    const required = getRequiredModifiers(product)
    if (required.length === 0) return true

    const sel = selections[product.id] || {}
    return required.every((mod) => sel[mod.key])
  }

  function handleModifierChange(productId, modKey, value) {
    setSelections((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [modKey]: value },
    }))
  }

  function handleQuantityChange(productId, delta) {
    setQuantities((prev) => {
      const current = prev[productId] || 1
      const next = Math.max(1, current + delta)
      return { ...prev, [productId]: next }
    })
  }

  function addToCart(product) {
    if (!isSelectionComplete(product)) return

    const qty = quantities[product.id] || 1
    const price = getProductPrice(product)
    const mods = selections[product.id] || {}

    setCart((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: price,
        selected_modifiers: mods,
      },
    ])

    setSelections((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })
    setQuantities((prev) => {
      const next = { ...prev }
      delete next[product.id]
      return next
    })
  }

  function removeFromCart(index) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart]
  )

  async function submitOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    setOrderSuccess(false)

    const items = cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_modifiers: item.selected_modifiers,
    }))

    const { error } = await supabase.rpc('create_dealer_order', {
      p_items: items,
    })

    if (!error) {
      setCart([])
      setOrderSuccess(true)
      fetchDashboardData()
    }

    setSubmitting(false)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Veriler yükleniyor...</p>
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Bayi Paneli</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Güncel Borç
          </p>
          <p className={`text-2xl font-semibold ${balance > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {formatCurrency(balance)}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Son Tahsilat
          </p>
          {lastReceipt ? (
            <>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(lastReceipt.amount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{formatDate(lastReceipt.created_at)}</p>
            </>
          ) : (
            <p className="text-2xl font-semibold text-gray-400">—</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-sm">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Ürün Listesi</h2>
            </div>

            {products.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">
                Aktif ürün bulunmuyor.
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {products.map((product) => {
                  const requiredMods = getRequiredModifiers(product)
                  const canAdd = isSelectionComplete(product)

                  return (
                    <div key={product.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {formatCurrency(getProductPrice(product))}
                          </p>

                          {requiredMods.map((mod) => (
                            <div key={mod.key} className="mt-3">
                              <p className="text-xs font-medium text-gray-500 mb-1.5">
                                {mod.label} *
                              </p>
                              <div className="flex gap-2">
                                {(mod.options || []).map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      handleModifierChange(product.id, mod.key, opt)
                                    }
                                    className={`px-3 py-1 text-xs border rounded-sm transition-colors ${
                                      selections[product.id]?.[mod.key] === opt
                                        ? 'border-[#580F1C] bg-[#580F1C] text-white'
                                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center border border-gray-300 rounded-sm">
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(product.id, -1)}
                                className="px-2 py-1 text-gray-500 hover:bg-gray-50"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="px-3 py-1 text-sm text-gray-900 min-w-[2rem] text-center">
                                {quantities[product.id] || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(product.id, 1)}
                                className="px-2 py-1 text-gray-500 hover:bg-gray-50"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => addToCart(product)}
                              disabled={!canAdd}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Sepete Ekle
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white border border-gray-200 rounded-sm sticky top-4">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Sepet</h2>
              <span className="text-xs text-gray-400 ml-auto">{cart.length} kalem</span>
            </div>

            {orderSuccess && (
              <p className="mx-5 mt-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded-sm px-3 py-2">
                Siparişiniz başarıyla oluşturuldu.
              </p>
            )}

            {cart.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Sepet boş.</p>
            ) : (
              <>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {cart.map((item, index) => (
                    <div key={index} className="px-5 py-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </p>
                        {Object.keys(item.selected_modifiers).length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {Object.values(item.selected_modifiers).join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(index)}
                        className="text-gray-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-500">Toplam</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(cartTotal)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={submitting}
                    className="w-full py-2.5 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Gönderiliyor...' : 'Sipariş Ver'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
