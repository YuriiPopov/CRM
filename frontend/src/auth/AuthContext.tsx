import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, login as loginRequest } from '../api/auth'
import { getStoredToken, setStoredToken, setUnauthorizedHandler } from '../api/client'
import type { AuthenticatedUser } from '../types/auth'
import { AuthContext } from './auth-context'
import type { AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  // Без токена сессию восстанавливать не из чего — статус известен уже на первом рендере
  const [status, setStatus] = useState<AuthStatus>(() =>
    getStoredToken() ? 'loading' : 'unauthenticated',
  )
  const [user, setUser] = useState<AuthenticatedUser | null>(null)

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  // Центральный axios-interceptor вызывает это при 401 от любого запроса — сессия истекла/отозвана
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Восстановление сессии при загрузке страницы — токен уже есть, но профиль надо перепроверить у сервера
  useEffect(() => {
    if (!getStoredToken()) return

    fetchCurrentUser()
      .then((profile) => {
        setUser(profile)
        setStatus('authenticated')
      })
      .catch(() => {
        setStoredToken(null)
        setStatus('unauthenticated')
      })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const token = await loginRequest(email, password)
    setStoredToken(token)
    const profile = await fetchCurrentUser()
    setUser(profile)
    setStatus('authenticated')
  }, [])

  const value = useMemo(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
