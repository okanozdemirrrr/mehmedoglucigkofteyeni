const STATUS_CONFIG = {
  PENDING: { label: 'Onay Bekliyor', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  PREPARING: { label: 'Hazırlanıyor', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ON_THE_WAY: { label: 'Yolda', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  DELIVERED: { label: 'Teslim Edildi', className: 'bg-green-100 text-green-800 border-green-200' },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' }

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-sm ${config.className}`}
    >
      {config.label}
    </span>
  )
}
