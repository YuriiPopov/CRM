import '@testing-library/jest-dom/vitest'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { afterEach } from 'vitest'

// Реальных HTTP-запросов в тестах быть не должно: при включённом бэкенде они «срабатывали» бы
// по-настоящему, при выключенном — молча давали сетевую ошибку/401 и разлогинивали пользователя.
// Любой запрос, который тест не замокал (vi.mock модуля api/*, vi.spyOn, свой adapter), падает с
// понятной ошибкой. Ошибку могли проглотить (catch в компоненте), поэтому ещё и фиксируем запросы
// и валим тест в afterEach.
const unmockedRequests: string[] = []

function unmocked(method: string, url: string): Error {
  const message = `Незамоканный запрос: ${method.toUpperCase()} ${url}`
  unmockedRequests.push(message)
  return new Error(message)
}

// Дефолтный adapter подхватывают все axios.create() — apiClient создаётся позже, при импорте тестом.
// Тест, который ставит свой adapter/мок на инстанс, этот дефолт перекрывает.
axios.defaults.adapter = (config: InternalAxiosRequestConfig) => {
  const url = axios.getUri(config)
  return Promise.reject(unmocked(config.method ?? 'get', url))
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
  return Promise.reject(unmocked(method, url))
}) as typeof fetch

afterEach(() => {
  if (unmockedRequests.length > 0) {
    const messages = [...new Set(unmockedRequests)]
    unmockedRequests.length = 0
    throw new Error(messages.join('\n'))
  }
})
