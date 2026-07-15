import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BayiBasvuru() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-sm p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6"
          >
            <ArrowLeft size={14} />
            Giriş sayfasına dön
          </Link>

          <h1 className="text-lg font-semibold text-gray-900 mb-2">Bayi Başvurusu</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            Bayi başvuruları şu an manuel olarak değerlendirilmektedir.
            Başvuru için lütfen <strong>0532 000 00 00</strong> numaralı telefondan
            veya <strong>info@mehmedoglucigkofte.com</strong> adresinden bizimle iletişime geçin.
          </p>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-sm">
            <p className="text-xs text-gray-500">
              Başvurunuz onaylandığında sisteme giriş bilgileriniz e-posta adresinize iletilecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
