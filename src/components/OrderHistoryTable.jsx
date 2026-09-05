import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../utils/format'
import StatusBadge from './StatusBadge'
import { StackTableWrap, stackTableClass } from './StackTable'

function formatModifiers(mods) {
  if (!mods || typeof mods !== 'object') return null
  const values = Object.values(mods).filter(Boolean)
  return values.length > 0 ? values.join(', ') : null
}

function OrderItemsList({ items }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400">Kalem bulunamadı.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const name = item.products?.name || 'Ürün'
        const mods = formatModifiers(item.selected_modifiers_jsonb)
        const lineTotal = Number(item.unit_price) * Number(item.quantity)

        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-gray-100 last:border-0 text-xs"
          >
            <div className="text-gray-900 min-w-0">
              {name}
              {mods && <span className="text-gray-400 ml-1">({mods})</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 shrink-0">
              <span>{item.quantity} adet</span>
              <span>{formatCurrency(item.unit_price)} / birim</span>
              <span className="font-medium text-gray-900">{formatCurrency(lineTotal)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Siparişleri kalem kalem (order_items) dökümle gösteren akordeon tablo.
 * orders + order_items (+ products) join sonucu bekler.
 */
export default function OrderHistoryTable({
  orders,
  emptyMessage = 'Henüz sipariş bulunmuyor.',
  title = 'Geçmiş Siparişler ve Hareketler',
  subtitle = 'Her siparişin ürün kalemleri, miktar ve birim fiyatı',
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggle(orderId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>

      {orders.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400 text-center">{emptyMessage}</p>
      ) : (
        <>
          {/* Mobil: kart görünümü */}
          <div className="md:hidden divide-y divide-gray-100">
            {orders.map((order) => {
              const open = expandedIds.has(order.id)
              const items = order.order_items || []

              return (
                <div key={order.id} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(order.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-gray-400 mt-0.5 shrink-0">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800">
                            {formatDateTime(order.created_at)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            #{String(order.id).slice(0, 8)} · {items.length} kalem
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <StatusBadge status={order.status} />
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatCurrency(order.total_amount)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {open && (
                    <div className="mt-3 pl-6 pr-1 py-2 bg-[#580F1C]/[0.03] rounded-sm">
                      <OrderItemsList items={items} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Masaüstü: tablo */}
          <StackTableWrap>
            <table className={`${stackTableClass()} hidden md:table`}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">
                    Tarih / Saat
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Sipariş</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Durum</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const open = expandedIds.has(order.id)
                  const items = order.order_items || []

                  return (
                    <Fragment key={order.id}>
                      <tr
                        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => toggle(order.id)}
                      >
                        <td className="px-3 py-3 text-gray-400">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-700 font-medium whitespace-nowrap">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          #{String(order.id).slice(0, 8)}
                          <span className="text-gray-400 ml-2">{items.length} kalem</span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-[#580F1C]/[0.03]">
                          <td colSpan={5} className="px-5 py-3">
                            <OrderItemsList items={items} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </StackTableWrap>
        </>
      )}
    </div>
  )
}
