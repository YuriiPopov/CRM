import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { listBookings } from '../api/bookings'
import { listClients } from '../api/clients'
import { getRevenueReport } from '../api/payments'
import { getApiErrorMessage } from '../api/errors'
import { formatTimeRange, toDateOnly, todayDateOnly } from './calendar/dateUtils'
import { STATUS_LABELS } from './calendar/statusTransitions'
import { countByStatus, currentMonthRange, upcomingBookings } from './dashboard/dashboardUtils'
import type { Booking, BookingStatus } from '../types/booking'
import type { Client } from '../types/client'
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
                  <span>{STATUS_LABELS[booking.status]}</span>
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
