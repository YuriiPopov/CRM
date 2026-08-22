import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { listBookings, updateBookingStatus } from '../api/bookings'
import { listClients } from '../api/clients'
import { listStaff } from '../api/staff'
import { listServices } from '../api/services'
import { listPayments } from '../api/payments'
import { getApiErrorMessage } from '../api/errors'
import { ALL_MASTERS, filterBookingsForDay } from './calendar/filterBookings'
import { todayDateOnly } from './calendar/dateUtils'
import { BookingListItem } from './calendar/BookingListItem'
import { MasterColumnsView } from './calendar/MasterColumnsView'
import { CreateBookingModal } from './calendar/CreateBookingModal'
import { RescheduleModal } from './calendar/RescheduleModal'
import { CreatePaymentModal } from './calendar/CreatePaymentModal'
import type { Booking, BookingStatus } from '../types/booking'
import type { Client } from '../types/client'
import type { Master } from '../types/staff'
import type { Service } from '../types/service'
import type { PaymentView } from '../types/payment'

// Один и тот же экран смонтирован и на /calendar (ADMIN), и на /my-schedule (MASTER) —
// поведение различается только за счёт роли из useAuth(), а не отдельных компонентов.
export function CalendarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const title = isAdmin ? 'Календарь записей' : 'Моё расписание'

  const [selectedDate, setSelectedDate] = useState(todayDateOnly)
  const [selectedMasterId, setSelectedMasterId] = useState<string>(ALL_MASTERS)
  const [viewMode, setViewMode] = useState<'list' | 'byMaster'>('list')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [payments, setPayments] = useState<PaymentView[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null)

  const reloadBookings = useCallback(() => listBookings().then(setBookings), [])
  const reloadPayments = useCallback(() => listPayments().then(setPayments), [])

  // Роль не меняется без повторного логина (и, значит, ремаунта), так что этот эффект
  // фактически выполняется один раз при монтировании — loading/loadError уже верны в initial state.
  useEffect(() => {
    let cancelled = false

    const requests: Promise<unknown>[] = [reloadBookings(), listClients().then(setClients), listServices().then(setServices)]
    if (isAdmin) {
      requests.push(listStaff().then(setMasters))
      // Оплаты нужны только ADMIN — определить, у каких COMPLETED-записей ещё нет Payment
      // (кнопка "Создать оплату" в BookingListItem) и пометить уже оплаченные.
      requests.push(reloadPayments())
    }

    Promise.all(requests)
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error, 'Не удалось загрузить данные календаря'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin, reloadBookings, reloadPayments])

  // В режиме "По мастерам" фильтр одного мастера теряет смысл (там и так одна колонка на
  // каждого мастера), поэтому он игнорируется, пока viewMode === 'byMaster', и снова
  // применяется при возврате к "Список" — без сброса самого selectedMasterId.
  const dayBookings = useMemo(
    () =>
      filterBookingsForDay(
        bookings,
        selectedDate,
        isAdmin && viewMode === 'list' ? selectedMasterId : ALL_MASTERS,
      ),
    [bookings, selectedDate, selectedMasterId, isAdmin, viewMode],
  )

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const mastersById = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters])
  const servicesById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])
  const paidBookingIds = useMemo(() => new Set(payments.map((p) => p.bookingId)), [payments])

  const handleStatusChange = async (booking: Booking, status: BookingStatus) => {
    setActionError(null)
    setBusyBookingId(booking.id)
    try {
      await updateBookingStatus(booking.id, status)
      await reloadBookings()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось изменить статус записи'))
    } finally {
      setBusyBookingId(null)
    }
  }

  // Общий рендер карточки записи — используется и плоским списком, и колонками режима
  // "По мастерам", чтобы обе раскладки показывали абсолютно одинаковую карточку.
  const renderBookingItem = (booking: Booking) => (
    <BookingListItem
      key={booking.id}
      booking={booking}
      client={clientsById.get(booking.clientId)}
      master={mastersById.get(booking.masterId)}
      service={servicesById.get(booking.serviceId)}
      role={user!.role}
      isPaid={paidBookingIds.has(booking.id)}
      canCreatePayment={isAdmin && booking.status === 'COMPLETED' && !paidBookingIds.has(booking.id)}
      busy={busyBookingId === booking.id}
      onStatusChange={(status) => void handleStatusChange(booking, status)}
      onReschedule={() => setRescheduleTarget(booking)}
      onCreatePayment={() => setPaymentTarget(booking)}
    />
  )

  return (
    <section>
      <h1>{title}</h1>

      <div className="calendar-toolbar">
        <label htmlFor="calendar-date">
          Дата
          <input
            id="calendar-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>

        {isAdmin && viewMode === 'list' && (
          <label htmlFor="calendar-master-filter">
            Мастер
            <select
              id="calendar-master-filter"
              value={selectedMasterId}
              onChange={(event) => setSelectedMasterId(event.target.value)}
            >
              <option value={ALL_MASTERS}>Все мастера</option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button type="button" onClick={() => setCreateModalOpen(true)}>
          + Новая запись
        </button>
      </div>

      {isAdmin && (
        <div className="view-mode-toggle" role="group" aria-label="Режим отображения">
          <button
            type="button"
            aria-pressed={viewMode === 'list'}
            className={viewMode === 'list' ? 'active' : undefined}
            onClick={() => setViewMode('list')}
          >
            Список
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'byMaster'}
            className={viewMode === 'byMaster' ? 'active' : undefined}
            onClick={() => setViewMode('byMaster')}
          >
            По мастерам
          </button>
        </div>
      )}

      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : viewMode === 'byMaster' ? (
        masters.some((master) => master.isActive) ? (
          <MasterColumnsView masters={masters} bookings={dayBookings} renderBooking={renderBookingItem} />
        ) : (
          <p>Нет активных мастеров</p>
        )
      ) : dayBookings.length === 0 ? (
        <p>На эту дату записей нет</p>
      ) : (
        <ul className="booking-list">{dayBookings.map((booking) => renderBookingItem(booking))}</ul>
      )}

      {createModalOpen && (
        <CreateBookingModal
          clients={clients}
          masters={masters}
          services={services}
          defaultDate={selectedDate}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => void reloadBookings()}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          masters={masters}
          service={servicesById.get(rescheduleTarget.serviceId)}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => void reloadBookings()}
        />
      )}

      {paymentTarget && (
        <CreatePaymentModal
          booking={paymentTarget}
          service={servicesById.get(paymentTarget.serviceId)}
          onClose={() => setPaymentTarget(null)}
          onCreated={() => void reloadPayments()}
        />
      )}
    </section>
  )
}
