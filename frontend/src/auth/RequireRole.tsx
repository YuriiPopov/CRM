import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Role } from '../types/auth'

// Предполагает, что уже отработал RequireAuth выше по дереву маршрутов (user точно есть)
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()

  if (!user || user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
