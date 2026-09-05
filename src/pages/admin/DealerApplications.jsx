import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatDate } from '../../utils/format'
import { StackTableWrap, stackTableClass } from '../../components/StackTable'

export default function DealerApplications() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchApplications()
  }, [])

  async function fetchApplications() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, age, city, district, tax_no, phone, email, status, created_at')
      .eq('status', 'PENDING')
      .eq('role', 'DEALER')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setApplications([])
    } else {
      setApplications(data || [])
    }

    setLoading(false)
  }

  async function handleApprove(profileId) {
    if (!window.confirm('Bu başvuruyu kabul edip bayi kaydı oluşturmak istiyor musunuz?')) {
      return
    }

    setActionId(profileId)
    setError('')

    const { error: rpcError } = await supabase.rpc('approve_dealer_application', {
      p_profile_id: profileId,
    })

    setActionId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    fetchApplications()
  }

  async function handleReject(profileId) {
    if (
      !window.confirm(
        'Bu başvuruyu reddetmek istediğinize emin misiniz? Hesap kalıcı olarak silinecektir.'
      )
    ) {
      return
    }

    setActionId(profileId)
    setError('')

    const { error: rpcError } = await supabase.rpc('reject_dealer_application', {
      p_profile_id: profileId,
    })

    setActionId(null)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    fetchApplications()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Başvurular yükleniyor...</p>
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Bayi Başvuruları</h1>
      <p className="text-sm text-gray-500 mb-6">Onay bekleyen bayi kayıt talepleri</p>

      {error && (
        <p className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-sm">
        {applications.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">
            Bekleyen başvuru bulunmuyor.
          </p>
        ) : (
          <StackTableWrap>
            <table className={stackTableClass()}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Ad Soyad</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">E-posta</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Yaş</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">İl / İlçe</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Vergi No</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Telefon</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Tarih</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td data-label="Ad Soyad" className="px-5 py-3 font-medium text-gray-900">
                      {app.full_name}
                    </td>
                    <td data-label="E-posta" className="px-5 py-3 text-gray-700 break-all">
                      {app.email || '—'}
                    </td>
                    <td data-label="Yaş" className="px-5 py-3 text-gray-700">
                      {app.age ?? '—'}
                    </td>
                    <td data-label="İl / İlçe" className="px-5 py-3 text-gray-700">
                      {[app.city, app.district].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td data-label="Vergi No" className="px-5 py-3 text-gray-700">
                      {app.tax_no || '—'}
                    </td>
                    <td data-label="Telefon" className="px-5 py-3 text-gray-700">
                      {app.phone || '—'}
                    </td>
                    <td data-label="Tarih" className="px-5 py-3 text-xs text-gray-500">
                      {formatDate(app.created_at)}
                    </td>
                    <td data-label="İşlem" className="stack-actions px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={actionId === app.id}
                          onClick={() => handleApprove(app.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-700 rounded-sm hover:bg-green-800 disabled:opacity-50"
                        >
                          <Check size={12} />
                          Kabul Et
                        </button>
                        <button
                          type="button"
                          disabled={actionId === app.id}
                          onClick={() => handleReject(app.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-sm hover:bg-red-800 disabled:opacity-50"
                        >
                          <X size={12} />
                          Reddet
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
    </div>
  )
}
