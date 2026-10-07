import axios from 'axios'
import {
  CLIENT_API_HEADER,
  CLIENT_API_VERSION,
  isClientUpdateRequiredError,
  markClientUpdateRequired,
} from './clientUpdate'

const TOKEN_STORAGE_KEY = 'b4u_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

// AuthProvider регистрирует себя как обработчик 401, чтобы центральный interceptor
// мог разлогинить пользователя, не зная напрямую про AuthContext (без циклического импорта).
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

// По умолчанию бэкенд ищем на том же хосте, с которого открыта страница (порт 3000) —
// так работает и доступ по LAN IP с телефона по Wi-Fi, и по `adb reverse` через USB-кабель
// (там страница открывается как localhost, и baseURL должен быть тоже localhost).
// VITE_API_URL, если задан явно, имеет приоритет.
const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
})

apiClient.interceptors.request.use((config) => {
  config.headers.set(CLIENT_API_HEADER, String(CLIENT_API_VERSION))
  const token = getStoredToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // 426 — не 401 и не сетевая ошибка: сессию не трогаем, показываем экран «Обновите страницу»
    if (isClientUpdateRequiredError(error)) {
      markClientUpdateRequired()
    }
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      setStoredToken(null)
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)
