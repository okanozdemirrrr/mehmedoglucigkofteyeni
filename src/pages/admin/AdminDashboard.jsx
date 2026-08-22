import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../utils/format'
import StatusBadge from '../../components/StatusBadge'

const NEXT_STATUS = {
  PENDING: 'PREPARING',
  PREPARING: 'ON_THE_WAY',
  ON_THE_WAY: 'DELIVERED',
}

const STATUS_LABELS = {
  PREPARING: 'Hazırla',
  ON_THE_WAY: 'Yola Çıkar',
  DELIVERED: 'Teslim Et',
}

export default function AdminDashboard() {
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalReceivable, setTotalReceivable] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [activeOrders, setActiveOrders] = useState([])
  const [archivedOrders, setArchivedOrders] = useState([])
  const [riskDealers, setRiskDealers] = useState([])
  const [pendingReturns, setPendingReturns] = useState([])
  const [returnActionId, setReturnActionId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const since = sevenDaysAgo.toISOString()

    const [
      deliveredRes,
      transactionsRes,
      pendingRes,
      activeRes,
      archiveRes,
      dealersRes,
      returnsRes,
    ] = await Promise.all([
      supabase.from('orders').select('total_amount').eq('status', 'DELIVERED'),
      supabase.from('transactions').select('dealer_id, transaction_type, amount'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase
        .from('orders')
        .select('id, total_amount, status, created_at, dealers ( name )')
        .in('status', ['PENDING', 'PREPARING', 'ON_THE_WAY'])
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, total_amount, updated_at, dealers ( name )')
        .eq('status', 'DELIVERED')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false }),
      supabase.from('dealers').select('id, name'),
      supabase
        .from('return_requests')
        .select('id, product_name, quantity, reason, created_at, dealers ( name )')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false }),
    ])

    setTotalRevenue(
      (deliveredRes.data || []).reduce((sum, o) => sum + Number(o.total_amount), 0)
    )

    const balanceByDealer = {}
    for (const tx of transactionsRes.data || []) {
      if (!balanceByDealer[tx.dealer_id]) balanceByDealer[tx.dealer_id] = 0
      balanceByDealer[tx.dealer_id] +=
        tx.transaction_type === 'DEBT' ? Number(tx.amount) : -Number(tx.amount)
    }

    setTotalReceivable(
      Object.values(balanceByDealer).reduce((sum, bal) => sum + Math.max(bal, 0), 0)
    )

    setPendingCount(pendingRes.count || 0)
    setActiveOrders(activeRes.data || [])
    setArchivedOrders(archiveRes.data || [])

    const risk = (dealersRes.data || [])
      .map((d) => ({
        ...d,
        balance: balanceByDealer[d.id] || 0,
      }))
      .sort((a, b) => b.balance - a.balance)

    setRiskDealers(risk)
    setPendingReturns(returnsRes.data || [])
    setLoading(false)
  }

  async function updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (!error) fetchDashboardData()
  }

  async function handleReturnAction(returnId, action) {
    setReturnActionId(returnId)
    const rpcName = action === 'approve' ? 'approve_return_request' : 'reject_return_request'
    const { error } = await supabase.rpc(rpcName, { p_return_id: returnId })
    setReturnActionId(null)
    if (!error) fetchDashboardData()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Kokpit yükleniyor...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900">Komuta Merkezi</h1>

      {/* KPI Satırı */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Toplam Ciro
          </p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Teslim edilen siparişler</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Toplam Alacak
          </p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalReceivable)}</p>
          <p className="text-xs text-gray-400 mt-1">Bayi cari bakiyeleri toplamı</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Bekleyen Sipariş
          </p>
          <p className="text-2xl font-semibold text-orange-700">{pendingCount}</p>
          <p className="text-xs text-gray-400 mt-1">Onay bekleyen siparişler</p>
        </div>
      </div>

      {/* Orta: Aktif Operasyon + Arşiv */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Aktif Operasyon</h2>
            <p className="text-xs text-gray-400 mt-0.5">Onay bekleyen, hazırlanan ve yoldaki siparişler</p>
          </div>

          {activeOrders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Aktif sipariş bulunmuyor.</p>
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
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        {NEXT_STATUS[order.status] && (
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(order.id, NEXT_STATUS[order.status])}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100"
                          >
                            {STATUS_LABELS[NEXT_STATUS[order.status]]}
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

        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Son 7 Gün Arşivi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Teslim edilen siparişler</p>
          </div>

          {archivedOrders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">Son 7 günde teslimat yok.</p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {archivedOrders.map((order) => (
                <li key={order.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900">{order.dealers?.name || '-'}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">{formatDate(order.updated_at)}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bekleyen İade Talepleri */}
      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Bekleyen İade Talepleri</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Onaylandığında bayi borcu güncel fiyattan otomatik düşülür
          </p>
        </div>

        {pendingReturns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Bekleyen iade talebi yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Bayi</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Ürün</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Miktar</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Sebep</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tarih</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pendingReturns.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-900">{req.dealers?.name || '-'}</td>
                    <td className="px-5 py-3 text-gray-900">{req.product_name}</td>
                    <td className="px-5 py-3 text-gray-700">{req.quantity}</td>
                    <td className="px-5 py-3 text-gray-600">{req.reason}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{formatDate(req.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={returnActionId === req.id}
                          onClick={() => handleReturnAction(req.id, 'approve')}
                          className="text-xs px-2 py-1 bg-[#580F1C] text-white rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          disabled={returnActionId === req.id}
                          onClick={() => handleReturnAction(req.id, 'reject')}
                          className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alt: Cari Risk Raporu */}
      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Cari Risk Raporu</h2>
          <p className="text-xs text-gray-400 mt-0.5">En yüksek borçtan en düşüğe sıralı</p>
        </div>

        {riskDealers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Kayıtlı bayi bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">#</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Bayi</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Bakiye</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {riskDealers.map((dealer, index) => (
                  <tr key={dealer.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-400 text-xs">{index + 1}</td>
                    <td className="px-5 py-3 text-gray-900">{dealer.name}</td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        dealer.balance > 0 ? 'text-red-700' : 'text-gray-900'
                      }`}
                    >
                      {formatCurrency(dealer.balance)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/admin/bayiler/${dealer.id}`}
                        className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100"
                      >
                        Detay
                      </Link>
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
