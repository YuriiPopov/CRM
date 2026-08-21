import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// "/" сам по себе не страница — уводит на дефолтный раздел для роли пользователя
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'ADMIN' ? '/dashboard' : '/my-schedule'} replace />
}
