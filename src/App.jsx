import { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { useAuth } from './store/useAuth'
import SetupRequired from './components/SetupRequired'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { lazyWithRetry } from './lib/lazyWithRetry'

const Login = lazyWithRetry(() => import('./pages/Login'), 'Giriş')
const BayiBasvuru = lazyWithRetry(() => import('./pages/BayiBasvuru'), 'Bayi başvurusu')
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'), 'Admin paneli')
const DealerList = lazyWithRetry(() => import('./pages/admin/DealerList'), 'Bayi listesi')
const DealerProfile = lazyWithRetry(() => import('./pages/admin/DealerProfile'), 'Bayi profili')
const MenuManagement = lazyWithRetry(() => import('./pages/admin/MenuManagement'), 'Menü yönetimi')
const DealerApplications = lazyWithRetry(
  () => import('./pages/admin/DealerApplications'),
  'Başvurular'
)
const BayiDashboard = lazyWithRetry(() => import('./pages/dealer/BayiDashboard'), 'Bayi paneli')
const ReturnRequest = lazyWithRetry(() => import('./pages/dealer/ReturnRequest'), 'İade')
const AccountSettings = lazyWithRetry(() => import('./pages/AccountSettings'), 'Hesap ayarları')
const Gizlilik = lazyWithRetry(() => import('./pages/Gizlilik'), 'Gizlilik')
const ProductCatalog = lazyWithRetry(() => import('./pages/ProductCatalog'), 'Ürün vitrini')
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetail'), 'Ürün detayı')
const SifreYenile = lazyWithRetry(() => import('./pages/SifreYenile'), 'Şifre yenile')
const SifremiUnuttum = lazyWithRetry(() => import('./pages/SifremiUnuttum'), 'Şifremi unuttum')

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Yükleniyor...</p>
    </div>
  )
}

function HomePage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (user && profile?.status === 'APPROVED') {
    if (profile.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
    if (profile.role === 'DEALER') return <Navigate to="/bayi/dashboard" replace />
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <ProductCatalog />
    </Suspense>
  )
}

function FallbackRoute() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (user && profile?.status === 'APPROVED') {
    if (profile.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
    return <Navigate to="/bayi/dashboard" replace />
  }

  return <Navigate to="/urunler" replace />
}

export default function App() {
  const initialize = useAuth((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!isSupabaseConfigured) {
    return <SetupRequired />
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/urunler" element={<ProductCatalog />} />
          <Route path="/urunler/:productId" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sifremi-unuttum" element={<SifremiUnuttum />} />
          <Route path="/sifre-yenile" element={<SifreYenile />} />
          <Route path="/bayi-basvuru" element={<BayiBasvuru />} />
          <Route path="/gizlilik" element={<Gizlilik />} />

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route element={<Layout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/bayiler" element={<DealerList />} />
              <Route path="/admin/bayiler/:dealerId" element={<DealerProfile />} />
              <Route path="/admin/basvurular" element={<DealerApplications />} />
              <Route path="/admin/menu" element={<MenuManagement />} />
              <Route path="/admin/ayarlar" element={<AccountSettings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['DEALER']} />}>
            <Route element={<Layout />}>
              <Route path="/bayi/dashboard" element={<BayiDashboard />} />
              <Route path="/bayi/iade" element={<ReturnRequest />} />
              <Route path="/bayi/ayarlar" element={<AccountSettings />} />
            </Route>
          </Route>

          <Route path="*" element={<FallbackRoute />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
