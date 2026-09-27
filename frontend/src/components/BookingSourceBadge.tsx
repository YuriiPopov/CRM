import type { BookingSource } from '../types/booking'

const ONLINE_SOURCE_LABEL = 'Из приложения'

interface BookingSourceBadgeProps {
  source: BookingSource
  className?: string
}

// Пометка записи, созданной клиентом в мобильном приложении (item61) — компактная иконка
// телефона, текст только в тултипе. Для записей из CRM (ADMIN) ничего не рендерит. Показывается
// обеим ролям и при любом статусе, включая отменённый.
export function BookingSourceBadge({ source, className }: BookingSourceBadgeProps) {
  if (source !== 'ONLINE') return null

  const classNames = ['booking-source-badge', className].filter(Boolean).join(' ')

  return (
    <span className={classNames} title={ONLINE_SOURCE_LABEL} aria-label={ONLINE_SOURCE_LABEL} role="img">
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
        <rect x="4" y="1" width="8" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="7" y1="12.5" x2="9" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}
