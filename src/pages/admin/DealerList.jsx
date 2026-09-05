import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency } from '../../utils/format'
import { StackTableWrap, stackTableClass } from '../../components/StackTable'

const emptyForm = {
  name: '',
  tax_no: '',
  phone: '',
  address: '',
}

export default function DealerList() {
  const [dealers, setDealers] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDealers()
  }, [])

  async function fetchDealers() {
    setLoading(true)

    const { data: dealerData } = await supabase
      .from('dealers')
      .select('id, name, tax_no, phone')
      .order('name')

    const { data: txData } = await supabase
      .from('transactions')
      .select('dealer_id, transaction_type, amount')

    const balanceMap = {}
    for (const tx of txData || []) {
      if (!balanceMap[tx.dealer_id]) balanceMap[tx.dealer_id] = 0
      if (tx.transaction_type === 'DEBT') {
        balanceMap[tx.dealer_id] += Number(tx.amount)
      } else {
        balanceMap[tx.dealer_id] -= Number(tx.amount)
      }
    }

    setDealers(dealerData || [])
    setBalances(balanceMap)
    setLoading(false)
  }

  function openModal() {
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setForm(emptyForm)
    setError('')
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: insertError } = await supabase.from('dealers').insert({
      name: form.name.trim(),
      tax_no: form.tax_no.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    closeModal()
    setSubmitting(false)
    fetchDealers()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Bayiler yükleniyor...</p>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Bayiler</h1>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] transition-colors"
        >
          <Plus size={14} />
          Yeni Bayi
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm">
        {dealers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Kayıtlı bayi bulunmuyor.
          </p>
        ) : (
          <StackTableWrap>
            <table className={stackTableClass()}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Bayi Adı</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Vergi No</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Telefon</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Bakiye</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((dealer) => (
                  <tr key={dealer.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td data-label="Bayi Adı" className="px-5 py-3 text-gray-900 font-medium">
                      {dealer.name}
                    </td>
                    <td data-label="Vergi No" className="px-5 py-3 text-gray-500">
                      {dealer.tax_no || '-'}
                    </td>
                    <td data-label="Telefon" className="px-5 py-3 text-gray-500">
                      {dealer.phone || '-'}
                    </td>
                    <td data-label="Bakiye" className="px-5 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(balances[dealer.id] || 0)}
                    </td>
                    <td data-label="" className="stack-actions px-5 py-3 text-right">
                      <Link
                        to={`/admin/bayiler/${dealer.id}`}
                        className="text-xs px-2 py-1 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StackTableWrap>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-gray-200 rounded-sm w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Yeni Bayi Oluştur</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                  Bayi Adı *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  placeholder="Firma adı"
                />
              </div>

              <div>
                <label htmlFor="tax_no" className="block text-xs font-medium text-gray-700 mb-1">
                  Vergi No
                </label>
                <input
                  id="tax_no"
                  name="tax_no"
                  type="text"
                  value={form.tax_no}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C]"
                  placeholder="0532 000 00 00"
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-xs font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:outline-none focus:border-[#580F1C] resize-none"
                  placeholder="İl / ilçe / açık adres"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 text-sm border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-[#580F1C] rounded-sm hover:bg-[#3d0a13] disabled:opacity-50"
                >
                  {submitting ? 'Kaydediliyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
