import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../utils/format'
import StatusBadge from '../../components/StatusBadge'

export default function AdminDashboard() {
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalReceivable, setTotalReceivable] = useState(0)
  const [activeOrders, setActiveOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)

    const [deliveredRes, transactionsRes, ordersRes] = await Promise.all([
      supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'DELIVERED'),
      supabase
        .from('transactions')
        .select('dealer_id, transaction_type, amount'),
      supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          dealers ( name )
        `)
        .in('status', ['PENDING', 'PREPARING', 'ON_THE_WAY'])
        .order('created_at', { ascending: false }),
    ])

    const revenue = (deliveredRes.data || []).reduce(
      (sum, o) => sum + Number(o.total_amount),
      0
    )
    setTotalRevenue(revenue)

    const balanceByDealer = {}
    for (const tx of transactionsRes.data || []) {
      if (!balanceByDealer[tx.dealer_id]) balanceByDealer[tx.dealer_id] = 0
      if (tx.transaction_type === 'DEBT') {
        balanceByDealer[tx.dealer_id] += Number(tx.amount)
      } else {
        balanceByDealer[tx.dealer_id] -= Number(tx.amount)
      }
    }
    const receivable = Object.values(balanceByDealer).reduce(
      (sum, bal) => sum + Math.max(bal, 0),
      0
    )
    setTotalReceivable(receivable)

    setActiveOrders(ordersRes.data || [])
    setLoading(false)
  }

  async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (!error) {
      fetchDashboardData()
    }
  }

  const nextStatus = {
    PENDING: 'PREPARING',
    PREPARING: 'ON_THE_WAY',
    ON_THE_WAY: 'DELIVERED',
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Veriler yükleniyor...</p>
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Toplam Ciro
          </p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Teslim edilen siparişler</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Toplam Alacak
          </p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(totalReceivable)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Bayi cari bakiyeleri toplamı</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Aktif Siparişler</h2>
        </div>

        {activeOrders.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Aktif sipariş bulunmuyor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Bayi</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tutar</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Durum</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tarih</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-900">{order.dealers?.name || '-'}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      {nextStatus[order.status] && (
                        <button
                          onClick={() => updateOrderStatus(order.id, nextStatus[order.status])}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {nextStatus[order.status] === 'PREPARING' && 'Hazırla'}
                          {nextStatus[order.status] === 'ON_THE_WAY' && 'Yola Çıkar'}
                          {nextStatus[order.status] === 'DELIVERED' && 'Teslim Et'}
                        </button>
                      )}
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
