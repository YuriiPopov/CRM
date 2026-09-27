import { useContext } from 'react'
import { PendingOnlineCountContext } from './pending-online-context'
import type { PendingOnlineCountContextValue } from './pending-online-context'

const NO_PROVIDER: PendingOnlineCountContextValue = { count: 0, refresh: () => {} }

// Без провайдера (страница отрендерена вне AppLayout, например в тестах) — нулевой счётчик и
// no-op refresh, а не исключение: счётчик — вспомогательный сигнал, а не обязательная зависимость.
export function usePendingOnlineCount(): PendingOnlineCountContextValue {
  return useContext(PendingOnlineCountContext) ?? NO_PROVIDER
}
