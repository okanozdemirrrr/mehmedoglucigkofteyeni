export default function SetupRequired() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-sm p-8">
        <h1 className="text-lg font-semibold text-[#580F1C] mb-2">
          Supabase Yapılandırması Gerekli
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Uygulama çalışması için proje kök dizininde <code className="text-xs bg-gray-100 px-1">.env</code> dosyası oluşturmanız gerekiyor.
        </p>
        <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-sm overflow-x-auto leading-relaxed">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="text-xs text-gray-500 mt-4">
          Değerleri Supabase Dashboard → Project Settings → API bölümünden alın.
          Dosyayı kaydettikten sonra dev sunucusunu yeniden başlatın (<code className="bg-gray-100 px-1">npm run dev</code>).
        </p>
      </div>
    </div>
  )
}
