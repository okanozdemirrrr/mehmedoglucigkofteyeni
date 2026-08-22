import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileDown } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, formatDate } from '../../utils/format'
import { downloadCariEkstrePdf } from '../../utils/cariEkstrePdf'

function InfoRow({ label, value }) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-b-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

export default function DealerProfile() {
  const { dealerId } = useParams()
  const [dealer, setDealer] = useState(null)
  const [contactProfile, setContactProfile] = useState(null)
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

    const [dealerRes, txRes, profileRes] = await Promise.all([
      supabase.from('dealers').select('*').eq('id', dealerId).single(),
      supabase
        .from('transactions')
        .select('*')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, age, city, district, tax_no, phone, email, status, created_at')
        .eq('dealer_id', dealerId)
        .maybeSingle(),
    ])

    setDealer(dealerRes.data)
    setContactProfile(profileRes.data || null)
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

  const displayName = contactProfile?.full_name || dealer.name

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
          <h1 className="text-lg font-semibold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {(contactProfile?.tax_no || dealer.tax_no) &&
              `VKN: ${contactProfile?.tax_no || dealer.tax_no}`}
            {(contactProfile?.phone || dealer.phone) &&
              ` · ${contactProfile?.phone || dealer.phone}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadCariEkstrePdf(dealer, transactions)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
          >
            <FileDown size={14} />
            PDF Ekstre İndir
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Ödeme Al
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Güncel Bakiye
          </p>
          <p className={`text-3xl font-semibold ${balance > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {formatCurrency(balance)}
          </p>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Başvuru / İletişim Bilgileri</h2>
            <p className="text-xs text-gray-400 mt-0.5">Bayinin kayıt sırasında girdiği bilgiler</p>
          </div>
          <div className="px-5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <InfoRow label="İsim Soyisim" value={contactProfile?.full_name || dealer.name} />
            <InfoRow label="E-posta" value={contactProfile?.email} />
            <InfoRow label="Yaş" value={contactProfile?.age} />
            <InfoRow label="Telefon" value={contactProfile?.phone || dealer.phone} />
            <InfoRow label="İl" value={contactProfile?.city} />
            <InfoRow label="İlçe" value={contactProfile?.district} />
            <InfoRow label="Vergi No" value={contactProfile?.tax_no || dealer.tax_no} />
            <InfoRow label="Adres" value={dealer.address} />
            <InfoRow
              label="Hesap Durumu"
              value={
                contactProfile?.status === 'APPROVED'
                  ? 'Onaylı'
                  : contactProfile?.status || '—'
              }
            />
            <InfoRow
              label="Başvuru Tarihi"
              value={contactProfile?.created_at ? formatDate(contactProfile.created_at) : null}
            />
          </div>
          {!contactProfile && (
            <p className="px-5 pb-4 text-xs text-gray-400">
              Bu bayiye bağlı kullanıcı profili bulunamadı (manuel oluşturulmuş kayıt olabilir).
            </p>
          )}
        </div>
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
                            : tx.description?.startsWith('İade onayı')
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-green-100 text-green-800 border-green-200'
                        }`}
                      >
                        {tx.transaction_type === 'DEBT'
                          ? 'Borç'
                          : tx.description?.startsWith('İade onayı')
                            ? 'İade'
                            : 'Tahsilat'}
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
