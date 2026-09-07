import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Gizlilik() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6"
        >
          <ArrowLeft size={14} />
          Giriş sayfasına dön
        </Link>

        <div className="bg-white border border-gray-200 rounded-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Gizlilik Politikası</h1>
          
          <div className="prose prose-sm text-gray-700 leading-relaxed">
            <p>
              Mehmedoğlu B2B Sipariş Yönetimi uygulaması, yalnızca yetkili bayilerin 
              kullanımına özel kurumsal bir platformdur. Sipariş ve cari takibi amacıyla 
              toplanan ad, e-posta ve iletişim verileri kesinlikle üçüncü şahıslarla 
              paylaşılmaz veya ticari amaçla satılmaz. Verileriniz güvenli sunucularda 
              korunmaktadır.
            </p>
            
            <p className="mt-4">
              Kullanıcı hesaplarının ve ilişkili verilerin silinmesi talepleri için doğrudan 
              sistem yöneticisi ile iletişime geçilmelidir. Talepleriniz 7 iş günü içerisinde 
              işleme alınarak verileriniz sistemden kalıcı olarak silinecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
