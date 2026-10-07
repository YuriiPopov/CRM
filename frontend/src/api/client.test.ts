import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { renderHook } from '@testing-library/react'
import { AxiosError } from 'axios'
import { apiClient, setUnauthorizedHandler } from './client'
import { CLIENT_API_VERSION, resetClientUpdateRequired, useClientUpdateRequired } from './clientUpdate'

function respondWith(status: number, data: unknown = {}): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) => {
    const response = { data, status, statusText: '', headers: {}, config } as AxiosResponse
    return status >= 400
      ? Promise.reject(new AxiosError('failed', String(status), config, null, response))
      : Promise.resolve(response)
  }
}

describe('apiClient version header and 426 handling (item78)', () => {
  afterEach(() => {
    apiClient.defaults.adapter = undefined
    setUnauthorizedHandler(null)
    resetClientUpdateRequired()
    localStorage.clear()
  })

  it('sends X-Client-Api on every request', async () => {
    let sent: unknown
    apiClient.defaults.adapter = (config) => {
      sent = config.headers.get('X-Client-Api')
      return respondWith(200)(config)
    }

    await apiClient.get('/staff')

    expect(sent).toBe(String(CLIENT_API_VERSION))
  })

  it('treats 426 CLIENT_UPDATE_REQUIRED separately from 401: no logout, update flag raised', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    localStorage.setItem('b4u_token', 'token')
    apiClient.defaults.adapter = respondWith(426, { statusCode: 426, code: 'CLIENT_UPDATE_REQUIRED' })

    const flag = renderHook(() => useClientUpdateRequired())
    expect(flag.result.current).toBe(false)

    await expect(apiClient.get('/staff')).rejects.toBeDefined()

    await vi.waitFor(() => expect(flag.result.current).toBe(true))
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(localStorage.getItem('b4u_token')).toBe('token')
  })

  it('still logs out on 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    apiClient.defaults.adapter = respondWith(401)

    const flag = renderHook(() => useClientUpdateRequired())
    await expect(apiClient.get('/staff')).rejects.toBeDefined()

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(flag.result.current).toBe(false)
  })
})
