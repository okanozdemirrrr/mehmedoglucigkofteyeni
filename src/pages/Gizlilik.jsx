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
              Kullanıcı hesaplarının ve ilişkili verilerin silinmesi uygulamadaki Hesap Ayarları
              ekranından yapılabilir. Alternatif olarak destek ekibimize yazabilirsiniz.
              Talepleriniz 7 iş günü içerisinde işleme alınarak verileriniz sistemden kalıcı
              olarak silinecektir.
            </p>

            <p className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-700">
              Uygulama destek, şikayet ve hesap silme talepleriniz için bize ulaşın:{' '}
              <a
                href="mailto:destek@regonteknoloji.com"
                className="text-[#580F1C] font-medium underline underline-offset-2 hover:text-[#3d0a13]"
              >
                destek@regonteknoloji.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
