import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SUPPORT_EMAIL } from '../lib/appConfig'

export default function Gizlilik() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 safe-area-pad-t safe-area-pad-b pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/urunler"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6"
        >
          <ArrowLeft size={14} />
          Ürün vitrinine dön
        </Link>

        <div className="bg-white border border-gray-200 rounded-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Gizlilik Politikası</h1>
          <p className="text-xs text-gray-400 mb-6">Son güncelleme: 23 Kasım 2026</p>

          <div className="prose prose-sm text-gray-700 leading-relaxed space-y-4">
            <p>
              Mehmedoğlu B2B Sipariş Yönetimi (Regon / Mergen) uygulaması, yalnızca yetkili
              bayilerin kullanımına özel kurumsal bir platformdur. Bu politika, uygulamada
              hangi kişisel verilerin işlendiğini ve haklarınızı açıklar.
            </p>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Toplanan veriler</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Kimlik ve iletişim: ad soyad, e-posta, telefon</li>
                <li>Başvuru / bayi bilgileri: yaş, il, ilçe, vergi no, adres</li>
                <li>Hesap güvenliği: şifre (hash’lenerek saklanır)</li>
                <li>Sipariş ve cari hareket kayıtları (iş süreçleri için)</li>
                <li>
                  Bildirim token’ı (FCM / APNs): yalnızca push bildirimleri göndermek için
                </li>
                <li>Oturum ve teknik log kayıtları (güvenlik / hata ayıklama)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Kullanım amacı</h2>
              <p>
                Veriler yalnızca uygulama işlevselliği (bayi onayı, sipariş yönetimi, cari
                takip, destek) ve yasal yükümlülükler için işlenir. Reklam, profilleme veya
                çapraz uygulama takibi yapılmaz; verileriniz üçüncü şahıslara satılmaz.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                Saklama yeri ve üçüncü taraf hizmetler
              </h2>
              <p>
                Veriler Supabase altyapısında (Avrupa / Frankfurt bölgesi) saklanır. Push
                bildirimleri için Firebase Cloud Messaging (FCM) ve Apple Push Notification
                service (APNs) yalnızca bildirim iletimi amacıyla kullanılır.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Saklama süresi</h2>
              <p>
                Hesap aktif olduğu sürece veriler tutulur. Hesap silindiğinde kişisel
                bilgiler silinir veya anonimleştirilir. Muhasebe / sipariş geçmişi gibi
                yasal saklama gerektiren kayıtlar kişisel kimlikten arındırılarak
                tutulabilir.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Hesap silme</h2>
              <p>
                Giriş yaptıktan sonra Hesap Ayarları → Hesabımı Sil yoluyla hesabınızı
                silebilirsiniz. Bu işlem geri alınamaz. Alternatif olarak{' '}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-[#580F1C] font-medium underline underline-offset-2"
                >
                  {SUPPORT_EMAIL}
                </a>{' '}
                adresine yazabilirsiniz; talepler 7 iş günü içinde işleme alınır.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Haklarınız</h2>
              <p>
                Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme
                haklarınız vardır. Taleplerinizi destek e-postası üzerinden iletebilirsiniz.
              </p>
            </div>

            <p className="pt-4 border-t border-gray-100 text-sm text-gray-700">
              Uygulama destek, şikayet ve hesap silme talepleriniz için bize ulaşın:{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[#580F1C] font-medium underline underline-offset-2 hover:text-[#3d0a13]"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>

            <p className="text-xs text-gray-400">
              Bu politikanın web sürümü:{' '}
              <a
                href="/gizlilik.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-gray-600"
              >
                /gizlilik.html
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
