import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../utils/format'

export default function DealerProfile() {
  const { dealerId } = useParams()
  const [dealer, setDealer] = useState(null)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptDesc, setReceiptDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (dealerId) fetchDealerData()
  }, [dealerId])

  async function fetchDealerData() {
    setLoading(true)

    const [dealerRes, txRes] = await Promise.all([
      supabase.from('dealers').select('*').eq('id', dealerId).single(),
      supabase
        .from('transactions')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false }),
    ])

    setDealer(dealerRes.data)
    setTransactions(txRes.data || [])

    const bal = (txRes.data || []).reduce((sum, tx) => {
      return tx.transaction_type === 'DEBT'
        ? sum + Number(tx.amount)
        : sum - Number(tx.amount)
    }, 0)
    setBalance(bal)
    setLoading(false)
  }

  async function handleReceipt(e) {
    e.preventDefault()
    const amount = parseFloat(receiptAmount)
    if (!amount || amount <= 0) return

    setSubmitting(true)

    const { error } = await supabase.rpc('record_receipt', {
      p_dealer_id: dealerId,
      p_amount: amount,
      p_description: receiptDesc || 'Tahsilat',
    })

    if (!error) {
      setShowModal(false)
      setReceiptAmount('')
      setReceiptDesc('')
      fetchDealerData()
    }

    setSubmitting(false)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Bayi bilgileri yükleniyor...</p>
  }

  if (!dealer) {
    return <p className="text-sm text-gray-500">Bayi bulunamadı.</p>
  }

  return (
    <div>
      <Link
        to="/admin/bayiler"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4"
      >
        <ArrowLeft size={14} />
        Bayi listesine dön
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{dealer.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dealer.tax_no && `VKN: ${dealer.tax_no}`}
            {dealer.phone && ` · ${dealer.phone}`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
        >
          Ödeme Al
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-5 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Güncel Bakiye
        </p>
        <p className={`text-3xl font-semibold ${balance > 0 ? 'text-red-700' : 'text-gray-900'}`}>
          {formatCurrency(balance)}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Cari Hareketler</h2>
        </div>

        {transactions.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Henüz cari hareket bulunmuyor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tarih</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tür</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Açıklama</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(tx.created_at)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-sm ${
                          tx.transaction_type === 'DEBT'
                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                            : 'bg-green-100 text-green-800 border-green-200'
                        }`}
                      >
                        {tx.transaction_type === 'DEBT' ? 'Borç' : 'Tahsilat'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{tx.description || '-'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {tx.transaction_type === 'DEBT' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-gray-200 rounded-sm w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Tahsilat Kaydı</h3>
            <form onSubmit={handleReceipt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tutar (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Açıklama</label>
                <input
                  type="text"
                  value={receiptDesc}
                  onChange={(e) => setReceiptDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  placeholder="Nakit tahsilat"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 text-sm border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                >
                  {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
