import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { useAuth } from './store/useAuth'
import SetupRequired from './components/SetupRequired'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import BayiBasvuru from './pages/BayiBasvuru'
import AdminDashboard from './pages/admin/AdminDashboard'
import DealerList from './pages/admin/DealerList'
import DealerProfile from './pages/admin/DealerProfile'
import MenuManagement from './pages/admin/MenuManagement'
import DealerApplications from './pages/admin/DealerApplications'
import BayiDashboard from './pages/dealer/BayiDashboard'
import ReturnRequest from './pages/dealer/ReturnRequest'

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profile?.status && profile.status !== 'APPROVED') {
    return <Navigate to="/login" replace />
  }

  if (profile?.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/bayi/dashboard" replace />
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/bayi-basvuru" element={<BayiBasvuru />} />

        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<Layout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/bayiler" element={<DealerList />} />
            <Route path="/admin/bayiler/:dealerId" element={<DealerProfile />} />
            <Route path="/admin/basvurular" element={<DealerApplications />} />
            <Route path="/admin/menu" element={<MenuManagement />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['DEALER']} />}>
          <Route element={<Layout />}>
            <Route path="/bayi/dashboard" element={<BayiDashboard />} />
            <Route path="/bayi/iade" element={<ReturnRequest />} />
          </Route>
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
