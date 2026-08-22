import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../store/useAuth'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile?.status && profile.status !== 'APPROVED') {
    return <Navigate to="/login" replace state={{ notice: null, pendingBlocked: true }} />
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const redirect = profile.role === 'ADMIN' ? '/admin/dashboard' : '/bayi/dashboard'
    return <Navigate to={redirect} replace />
  }

  return <Outlet />
}
