import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { listBookings } from '../api/bookings'
import { listClients } from '../api/clients'
import { listStaff } from '../api/staff'
import { getRevenueReport } from '../api/payments'
import { getApiErrorMessage } from '../api/errors'
import { formatTimeRange, toDateOnly, todayDateOnly } from './calendar/dateUtils'
import { getStatusBadgeClass, STATUS_LABELS } from './calendar/statusTransitions'
import { countByStatus, currentMonthRange, upcomingBookings } from './dashboard/dashboardUtils'
import {
  filterActiveTimelineBookings,
  groupTimelineBlocksByMaster,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
} from './dashboard/timeline'
import { getMasterColor } from './dashboard/masterColor'
import type { Booking, BookingStatus } from '../types/booking'
import type { Client } from '../types/client'
import type { Master } from '../types/staff'
import type { RevenueReport } from '../types/payment'

// Общий компонент для /dashboard (стартовая страница ADMIN) — ADMIN видит сводку по всему салону
// (включая выручку), MASTER — упрощённую версию только по своим записям (см. StaffPage/CalendarPage
// для того же паттерна: сервер уже скоупит /bookings и /clients по роли, здесь только агрегация).
export function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const calendarPath = isAdmin ? '/calendar' : '/my-schedule'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [revenue, setRevenue] = useState<RevenueReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const requests: Promise<unknown>[] = [
      listBookings().then(setBookings),
      listClients().then(setClients),
    ]
    if (isAdmin) {
      const { from, to } = currentMonthRange()
      requests.push(getRevenueReport({ from, to }).then(setRevenue))
      // Список мастеров нужен только для таймлайна на сегодня (подпись строки — имя мастера
      // тем же цветом, что и его записи) — MASTER видит на таймлайне только свои же записи
      // в одной безымянной строке, ему список чужих мастеров не нужен.
      requests.push(listStaff().then(setMasters))
    }

    Promise.all(requests)
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить дашборд'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const today = todayDateOnly()
  const todayBookings = useMemo(
    () => bookings.filter((booking) => toDateOnly(booking.startTime) === today),
    [bookings, today],
  )
  const statusCounts = useMemo(() => countByStatus(todayBookings), [todayBookings])
  const upcoming = useMemo(
    () => upcomingBookings(bookings, new Date().toISOString()),
    [bookings],
  )
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients])

  // "Активные" в терминах таймлайна — без CANCELLED (см. timeline.ts). Для MASTER бэкенд
  // и так скоупит /bookings только его собственными записями, доп. фильтрации по мастеру не нужно.
  const timelineBookings = useMemo(() => filterActiveTimelineBookings(todayBookings), [todayBookings])
  // Одна строка на каждого мастера, у кого сегодня есть активная запись (masters для MASTER
  // не грузится и остаётся [] — тогда получаем ровно одну строку с его же записями).
  const timelineRows = useMemo(
    () => groupTimelineBlocksByMaster(timelineBookings, masters),
    [timelineBookings, masters],
  )
  const timelineHours = useMemo(
    () => Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }, (_, i) => TIMELINE_START_HOUR + i),
    [],
  )
  const hourToPercent = (hour: number) =>
    ((hour - TIMELINE_START_HOUR) / (TIMELINE_END_HOUR - TIMELINE_START_HOUR)) * 100

  if (loading) {
    return <p>Загрузка…</p>
  }

  return (
    <section>
      <h1>Дашборд</h1>

      {loadError && <p role="alert">{loadError}</p>}

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>Записи сегодня</h2>
          <p className="dashboard-metric">{todayBookings.length}</p>
          {todayBookings.length > 0 && (
            <ul className="dashboard-breakdown">
              {(Object.keys(statusCounts) as BookingStatus[])
                .filter((status) => statusCounts[status] > 0)
                .map((status) => (
                  <li key={status}>
                    {STATUS_LABELS[status]}: {statusCounts[status]}
                  </li>
                ))}
            </ul>
          )}
        </div>

        {isAdmin && (
          <div className="dashboard-card">
            <h2>Выручка за месяц</h2>
            {revenue ? (
              <>
                <p className="dashboard-metric">{revenue.netRevenue}</p>
                <p>Оплат: {revenue.paymentsCount}</p>
              </>
            ) : (
              <p>Нет данных за текущий месяц</p>
            )}
          </div>
        )}
      </div>

      <h2>Таймлайн на сегодня</h2>
      {timelineRows.length === 0 ? (
        <p>На сегодня активных записей нет</p>
      ) : (
        <div className="dashboard-timeline" role="img" aria-label="Таймлайн активных записей на сегодня">
          <div className="dashboard-timeline-inner">
            <div className="dashboard-timeline-hours">
              {isAdmin && <span className="dashboard-timeline-label-spacer" aria-hidden="true" />}
              <div className="dashboard-timeline-hours-track">
                {timelineHours.map((hour) => (
                  <span
                    key={hour}
                    className="dashboard-timeline-tick"
                    style={{ left: `${hourToPercent(hour)}%` }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </span>
                ))}
              </div>
            </div>

            {timelineRows.map((row) => (
              <div key={row.masterId} className="dashboard-timeline-row">
                {isAdmin && (
                  <div className="dashboard-timeline-row-label" style={{ color: getMasterColor(row.masterId) }}>
                    {row.masterName}
                  </div>
                )}
                <div className="dashboard-timeline-track">
                  {row.blocks.map(({ booking, leftPercent, widthPercent }) => {
                    const client = clientsById.get(booking.clientId)
                    const label = client?.name ?? 'Клиент не найден'
                    return (
                      <div
                        key={booking.id}
                        className="dashboard-timeline-block"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          background: isAdmin ? getMasterColor(row.masterId) : 'var(--accent)',
                        }}
                        title={`${formatTimeRange(booking.startTime, booking.endTime)} · ${label}`}
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2>Ближайшие записи</h2>
      {upcoming.length === 0 ? (
        <p>На сегодня и завтра записей нет</p>
      ) : (
        <ul className="booking-list">
          {upcoming.map((booking) => {
            const client = clientsById.get(booking.clientId)
            return (
              <li key={booking.id} className="booking-item">
                <div className="booking-item-time">
                  {formatTimeRange(booking.startTime, booking.endTime)}
                </div>
                <div className="booking-item-details">
                  <strong>
                    {client ? <Link to={`/clients/${client.id}`}>{client.name}</Link> : 'Клиент не найден'}
                  </strong>
                  <span className={`booking-item-status ${getStatusBadgeClass(booking.status)}`}>
                    {STATUS_LABELS[booking.status]}
                  </span>
                </div>
                <div className="booking-item-actions">
                  <Link to={calendarPath}>В календарь</Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
