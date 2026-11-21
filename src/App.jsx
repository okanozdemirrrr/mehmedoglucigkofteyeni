import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { useAuth } from './store/useAuth'
import SetupRequired from './components/SetupRequired'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const BayiBasvuru = lazy(() => import('./pages/BayiBasvuru'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const DealerList = lazy(() => import('./pages/admin/DealerList'))
const DealerProfile = lazy(() => import('./pages/admin/DealerProfile'))
const MenuManagement = lazy(() => import('./pages/admin/MenuManagement'))
const DealerApplications = lazy(() => import('./pages/admin/DealerApplications'))
const BayiDashboard = lazy(() => import('./pages/dealer/BayiDashboard'))
const ReturnRequest = lazy(() => import('./pages/dealer/ReturnRequest'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const Gizlilik = lazy(() => import('./pages/Gizlilik'))
const ProductCatalog = lazy(() => import('./pages/ProductCatalog'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
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
