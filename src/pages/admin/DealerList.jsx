import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency } from '../../utils/format'

export default function DealerList() {
  const [dealers, setDealers] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return <p className="text-sm text-gray-500">Bayiler yükleniyor...</p>
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Bayiler</h1>

      <div className="bg-white border border-gray-200 rounded-sm">
        {dealers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Kayıtlı bayi bulunmuyor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="px-5 py-3 text-gray-900">{dealer.name}</td>
                    <td className="px-5 py-3 text-gray-500">{dealer.tax_no || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{dealer.phone || '-'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(balances[dealer.id] || 0)}
                    </td>
                    <td className="px-5 py-3 text-right">
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
          </div>
        )}
      </div>
    </div>
  )
}
