import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getPendingOnlineCount } from '../api/bookings'
import { PENDING_ONLINE_POLL_INTERVAL_MS, usePolling } from '../hooks/usePolling'
import { PendingOnlineCountContext } from './pending-online-context'

interface PendingOnlineCountProviderProps {
  // = роль ADMIN; для MASTER запросы не делаются вовсе (эндпоинт отвечает ему 403)
  enabled: boolean
  children: ReactNode
}

// Счётчик онлайн-записей, ждущих подтверждения (item61): загрузка при монтировании, опрос раз в
// 60 секунд и refresh() после действий в виджете Дашборда. WebSocket/push сознательно не нужны.
export function PendingOnlineCountProvider({ enabled, children }: PendingOnlineCountProviderProps) {
  const [count, setCount] = useState(0)

  // Сбой опроса оставляет последнее известное значение — следующий тик попробует снова
  const refresh = useCallback(() => {
    getPendingOnlineCount()
      .then(setCount)
      .catch(() => {})
  }, [])

  usePolling(refresh, PENDING_ONLINE_POLL_INTERVAL_MS, enabled)

  const value = useMemo(() => ({ count: enabled ? count : 0, refresh }), [enabled, count, refresh])

  return <PendingOnlineCountContext.Provider value={value}>{children}</PendingOnlineCountContext.Provider>
}
