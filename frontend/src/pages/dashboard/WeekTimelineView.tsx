import { useMemo, useState } from 'react'
import { formatTimeRange } from '../calendar/dateUtils'
import { masterBlockCreatedByLabel } from '../calendar/masterBlockCreatedBy'
import { getMasterColor } from './masterColor'
import { getIsoWeekRange, groupBookingsByDayAndMaster } from './weekTimeline'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'
import type { Service } from '../../types/service'

const DAY_MS = 24 * 60 * 60 * 1000

interface WeekTimelineProps {
  bookings: Booking[]
  masters: Master[]
  masterBlocks: MasterBlock[]
  clients: Client[]
  services: Service[]
  isAdmin: boolean
}

function formatWeekRangeLabel(start: Date, end: Date): string {
  const endLabel = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()
  const startLabel = sameMonth
    ? start.toLocaleDateString('ru-RU', { day: 'numeric', timeZone: 'UTC' })
    : start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${startLabel}–${endLabel}`
}

function formatDayHeader(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00.000Z`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// Недельная загрузка мастеров ниже дневного таймлайна (см. DashboardPage) — переиспользует ту же
// инфраструктуру (filterActiveTimelineBookings, masterColor.ts, ролевой скоуп записей уже
// применён на уровне DashboardPage/бэкенда), просто раскладывая те же записи по 7 дням вместо
// одной 09:00–20:00 полосы. Полосочки — счётчик загрузки, поэтому все одного размера, без
// вычисления left/width в процентах, в отличие от дневного таймлайна.
export function WeekTimelineView({ bookings, masters, masterBlocks, clients, services, isAdmin }: WeekTimelineProps) {
  const [weekStart, setWeekStart] = useState(() => getIsoWeekRange(new Date()).start)
  const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * DAY_MS - 1), [weekStart])

  const columns = useMemo(
    () => groupBookingsByDayAndMaster(bookings, masters, weekStart, masterBlocks),
    [bookings, masters, weekStart, masterBlocks],
  )

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])
  const servicesById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])

  return (
    <div className="dashboard-week-timeline">
      <div className="dashboard-week-timeline-header">
        <button
          type="button"
          aria-label="Предыдущая неделя"
          onClick={() => setWeekStart((prev) => new Date(prev.getTime() - 7 * DAY_MS))}
        >
          ←
        </button>
        <span className="dashboard-week-timeline-label">{formatWeekRangeLabel(weekStart, weekEnd)}</span>
        <button
          type="button"
          aria-label="Следующая неделя"
          onClick={() => setWeekStart((prev) => new Date(prev.getTime() + 7 * DAY_MS))}
        >
          →
        </button>
      </div>

      <div className="dashboard-week-timeline-grid" role="img" aria-label="Таймлайн загрузки мастеров по неделе">
        {columns.map((column) => (
          <div
            key={column.date}
            className={`dashboard-week-day${column.isToday ? ' dashboard-week-day-today' : ''}`}
          >
            <div className="dashboard-week-day-header">{formatDayHeader(column.date)}</div>
            <div className="dashboard-week-day-bars">
              {column.bars.map((bar) => {
                const client = clientsById.get(bar.booking.clientId)
                const service = servicesById.get(bar.booking.serviceId)
                const title = [
                  formatTimeRange(bar.booking.startTime, bar.booking.endTime),
                  client?.name ?? 'Клиент не найден',
                  service?.name ?? 'Услуга не найдена',
                ].join(' · ')
                return (
                  <div
                    key={bar.booking.id}
                    className="dashboard-week-bar"
                    style={{ background: isAdmin ? getMasterColor(bar.masterId) : 'var(--accent)' }}
                    title={title}
                  />
                )
              })}
              {column.unavailableBars.map((bar) => {
                const createdByLabel = masterBlockCreatedByLabel(bar.block)
                const title = [
                  formatTimeRange(bar.block.startTime, bar.block.endTime),
                  bar.block.reason ?? 'Недоступен',
                  createdByLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div
                    key={bar.block.id}
                    className="dashboard-week-bar dashboard-week-bar-unavailable"
                    title={title}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
