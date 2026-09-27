import { useEffect, useRef } from 'react'

export const PENDING_ONLINE_POLL_INTERVAL_MS = 60_000

// Вызывает callback сразу и затем раз в intervalMs, пока enabled; интервал снимается при
// размонтировании или выключении. callback хранится в ref, чтобы новая функция на каждом
// рендере не перезапускала таймер.
export function usePolling(callback: () => void, intervalMs: number, enabled: boolean): void {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    callbackRef.current()
    const timer = window.setInterval(() => callbackRef.current(), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, enabled])
}
