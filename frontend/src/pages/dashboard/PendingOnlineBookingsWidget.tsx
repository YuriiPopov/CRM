import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listBookings, updateBookingStatus } from '../../api/bookings'
import { getApiErrorMessage } from '../../api/errors'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { MasterAvatar } from '../../components/MasterAvatar'
import { PENDING_ONLINE_POLL_INTERVAL_MS, usePolling } from '../../hooks/usePolling'
import { usePendingOnlineCount } from '../../pendingOnline/usePendingOnlineCount'
import { formatTimeRange } from '../calendar/dateUtils'
import { pendingOnlineBookings } from './pendingOnlineBookings'
import type { Booking, BookingStatus } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

interface PendingOnlineBookingsWidgetProps {
  clientsById: Map<string, Client>
  mastersById: Map<string, Master>
  servicesById: Map<string, Service>
  // Сообщает Дашборду о смене статуса, чтобы остальные виджеты (например «Ближайшие записи»)
  // сразу показали новый статус без перезагрузки всего списка записей.
  onBookingUpdated: (booking: Booking) => void
}

// Виджет «Ждут подтверждения» (item61, только ADMIN) — онлайн-записи из клиентского приложения
// в статусе CREATED, ещё не начавшиеся. Список грузится с сервером уже отфильтрованным и
// обновляется тем же 60-секундным опросом, что и счётчик в навигации, поэтому новая запись
// клиента появляется здесь без перезагрузки страницы.
export function PendingOnlineBookingsWidget({
  clientsById,
  mastersById,
  servicesById,
  onBookingUpdated,
}: PendingOnlineBookingsWidgetProps) {
  const { refresh: refreshPendingCount } = usePendingOnlineCount()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null)

  const reload = useCallback(() => {
    listBookings({ source: 'ONLINE', status: 'CREATED', from: new Date().toISOString() })
      .then((loaded) => {
        setBookings(loaded)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        setLoadError(getApiErrorMessage(error, 'Не удалось загрузить онлайн-записи'))
      })
  }, [])

  usePolling(reload, PENDING_ONLINE_POLL_INTERVAL_MS, true)

  // Повторный фильтр на клиенте — между опросами запись могла начаться и перестать быть «ожидающей»
  const visible = useMemo(() => pendingOnlineBookings(bookings, new Date().toISOString()), [bookings])

  const changeStatus = async (booking: Booking, status: BookingStatus) => {
    setActionError(null)
    setBusyBookingId(booking.id)
    try {
      const updated = await updateBookingStatus(booking.id, status)
      setBookings((prev) => prev.filter((b) => b.id !== booking.id))
      onBookingUpdated(updated)
      refreshPendingCount()
      setRejectTarget(null)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось изменить статус записи'))
    } finally {
      setBusyBookingId(null)
    }
  }

  return (
    <>
      <h2>Ждут подтверждения</h2>
      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {visible.length === 0 ? (
        <p>Нет онлайн-записей, ожидающих подтверждения</p>
      ) : (
        <ul className="booking-list pending-online-list">
          {visible.map((booking) => {
            const client = clientsById.get(booking.clientId)
            const master = mastersById.get(booking.masterId)
            const service = servicesById.get(booking.serviceId)
            const busy = busyBookingId === booking.id
            return (
              <li key={booking.id} className="booking-item">
                <div className="booking-item-time">
                  <div className="booking-item-date">{new Date(booking.startTime).toLocaleDateString('ru-RU')}</div>
                  <div className="booking-item-time-range">{formatTimeRange(booking.startTime, booking.endTime)}</div>
                </div>
                <div className="booking-item-details">
                  <div className="booking-item-info-row">
                    <strong>
                      {client ? <Link to={`/clients/${client.id}`}>{client.name}</Link> : 'Клиент не найден'}
                    </strong>
                    <span>{service?.name ?? 'Услуга не найдена'}</span>
                    <span className="pending-online-master">
                      {master && <MasterAvatar master={master} className="pending-online-master-avatar" />}
                      {master?.name ?? 'Мастер не найден'}
                    </span>
                  </div>
                </div>
                <div className="booking-item-actions">
                  <button type="button" disabled={busy} onClick={() => void changeStatus(booking, 'CONFIRMED')}>
                    Подтвердить
                  </button>
                  <button type="button" disabled={busy} onClick={() => setRejectTarget(booking)}>
                    Отклонить
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {rejectTarget && (
        <ConfirmDialog
          title="Отклонить запись?"
          message={`${clientsById.get(rejectTarget.clientId)?.name ?? 'Клиент'}: запись будет отменена, клиент получит уведомление.`}
          confirmLabel="Отклонить"
          busy={busyBookingId === rejectTarget.id}
          onConfirm={() => void changeStatus(rejectTarget, 'CANCELLED')}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </>
  )
}
