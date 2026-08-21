import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

interface LocationState {
  from?: { pathname: string }
}

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email, password)
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/'
      navigate(redirectTo, { replace: true })
    } catch {
      setError('Неверный email или пароль')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <h1>Вход в B4U CRM</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label htmlFor="password">
          Пароль
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
