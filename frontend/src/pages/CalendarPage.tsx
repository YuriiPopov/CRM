import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { listBookings, rescheduleBooking, updateBookingStatus } from '../api/bookings'
import { listClients } from '../api/clients'
import { listMasterServiceLinks, listStaff } from '../api/staff'
import { listServices } from '../api/services'
import { listPayments } from '../api/payments'
import { listMasterBlocks, deleteMasterBlock } from '../api/masterBlocks'
import { getApiErrorMessage } from '../api/errors'
import { ALL_MASTERS, filterBookingsForDay, filterBookingsForRange } from './calendar/filterBookings'
import { filterBlocksForDay, filterBlocksForRange } from './calendar/filterBlocksForDay'
import { groupBlocksByMaster } from './calendar/groupBlocksByMaster'
import { groupBookingsByDay } from './calendar/groupBookingsByDay'
import { groupBlocksByDay } from './calendar/groupBlocksByDay'
import { getMonthGridDays, getWeekGridDays, navigateGridAnchor } from './calendar/calendarGrid'
import { ALL_BOOKING_STATUSES, filterBookingsByVisibility } from './calendar/bookingVisibilityFilter'
import { shiftIsoToDateOnly, todayDateOnly } from './calendar/dateUtils'
import { STATUS_LABELS } from './calendar/statusTransitions'
import { BookingListItem } from './calendar/BookingListItem'
import { ScheduleBlockItem } from './calendar/ScheduleBlockItem'
import { MasterColumnsView } from './calendar/MasterColumnsView'
import { CalendarGridView } from './calendar/CalendarGridView'
import { CreateBookingModal } from './calendar/CreateBookingModal'
import { BlockTimeModal } from './calendar/BlockTimeModal'
import { RescheduleModal } from './calendar/RescheduleModal'
import { CreatePaymentModal } from './calendar/CreatePaymentModal'
import type { Booking, BookingStatus } from '../types/booking'
import type { Client } from '../types/client'
import type { Master, MasterServiceLink } from '../types/staff'
import type { Service } from '../types/service'
import type { PaymentView } from '../types/payment'
import type { MasterBlock } from '../types/masterBlock'
import type { PaymentVisibilityFilter } from './calendar/bookingVisibilityFilter'

// Один и тот же экран смонтирован и на /calendar (ADMIN), и на /my-schedule (MASTER) —
// поведение различается только за счёт роли из useAuth(), а не отдельных компонентов.
export function CalendarPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const title = isAdmin ? 'Календарь записей' : 'Моё расписание'

  const [selectedDate, setSelectedDate] = useState(todayDateOnly)
  const [selectedMasterId, setSelectedMasterId] = useState<string>(ALL_MASTERS)
  const [viewMode, setViewMode] = useState<'list' | 'byMaster' | 'week' | 'month'>('list')
  // Намеренно НЕ сбрасываем при смене даты — фильтр статуса/оплаты обычно листают вместе
  // с датами (например, "показывать только отменённые" при просмотре нескольких дней подряд).
  const [selectedStatuses, setSelectedStatuses] = useState<Set<BookingStatus>>(
    () => new Set(ALL_BOOKING_STATUSES),
  )
  const [paymentFilter, setPaymentFilter] = useState<PaymentVisibilityFilter>({
    showPaid: true,
    showUnpaid: true,
  })

  const [bookings, setBookings] = useState<Booking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [masterServiceLinks, setMasterServiceLinks] = useState<MasterServiceLink[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [blocks, setBlocks] = useState<MasterBlock[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null)
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null)

  const reloadBookings = useCallback(() => listBookings().then(setBookings), [])
  const reloadPayments = useCallback(() => listPayments().then(setPayments), [])
  // Блокировки грузятся без параметров from/to (см. MasterBlocksService.findAll) — их
  // немного (это не поток данных вроде записей), и на клиенте всё равно фильтруются на
  // конкретный день через filterBlocksForDay/groupBlocksByMaster, так что диапазон не нужен.
  const reloadBlocks = useCallback(() => listMasterBlocks().then(setBlocks), [])

  // Роль не меняется без повторного логина (и, значит, ремаунта), так что этот эффект
  // фактически выполняется один раз при монтировании — loading/loadError уже верны в initial state.
  useEffect(() => {
    let cancelled = false

    const requests: Promise<unknown>[] = [
      reloadBookings(),
      listClients().then(setClients),
      listServices().then(setServices),
      reloadBlocks(),
    ]
    if (isAdmin) {
      // Связки мастер↔услуга нужны только для формы создания записи (взаимная фильтрация
      // селектов "Мастер"/"Услуга") — грузим их сразу за списком мастеров, чтобы к моменту
      // открытия модалки данные уже были готовы.
      requests.push(
        listStaff().then((loadedMasters) => {
          setMasters(loadedMasters)
          return listMasterServiceLinks(loadedMasters.map((master) => master.id)).then(setMasterServiceLinks)
        }),
      )
      // Оплаты нужны только ADMIN — определить, у каких COMPLETED-записей ещё нет Payment
      // (кнопка "Создать оплату" в BookingListItem) и пометить уже оплаченные.
      requests.push(reloadPayments())
    } else if (user?.masterId) {
      // MASTER не грузит полный список мастеров (страница "Мастера" ему недоступна — см.
      // RequireRole в AppRoutes), но связка со своими услугами нужна форме создания записи,
      // чтобы список услуг сужался только до тех, что привязаны к нему (Backlog п.5).
      requests.push(listMasterServiceLinks([user.masterId]).then(setMasterServiceLinks))
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
  }, [isAdmin, user?.masterId, reloadBookings, reloadPayments, reloadBlocks])

  // В режиме "По мастерам" фильтр одного мастера теряет смысл (там и так одна колонка на
  // каждого мастера), поэтому он игнорируется, пока viewMode === 'byMaster', и снова
  // применяется при возврате к "Список"/"Неделя"/"Месяц" — без сброса самого selectedMasterId.
  const effectiveMasterFilter = isAdmin && viewMode !== 'byMaster' ? selectedMasterId : ALL_MASTERS

  const dayBookings = useMemo(
    () => filterBookingsForDay(bookings, selectedDate, effectiveMasterFilter),
    [bookings, selectedDate, effectiveMasterFilter],
  )

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const mastersById = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters])
  const servicesById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])
  const paidBookingIds = useMemo(() => new Set(payments.map((p) => p.bookingId)), [payments])

  // Резервирование времени мастера (Backlog п.9) — те же правила видимости, что у записей:
  // в режимах "Список"/"Неделя"/"Месяц" ADMIN может дополнительно сузить до одного мастера,
  // MASTER и так видит только свои блоки (бэкенд их скоупит), "По мастерам" использует
  // собственную группировку.
  const dayBlocks = useMemo(
    () => filterBlocksForDay(blocks, selectedDate, effectiveMasterFilter),
    [blocks, selectedDate, effectiveMasterFilter],
  )
  const blocksByMasterId = useMemo(() => groupBlocksByMaster(blocks, selectedDate), [blocks, selectedDate])

  // Недельная/месячная сетка: те же дни, что рендерит CalendarGridView, только для list/byMaster
  // это дешёвый no-op (пустой массив, ниже по цепочке — пустые Map).
  const gridDays = useMemo(() => {
    if (viewMode === 'week') return getWeekGridDays(selectedDate)
    if (viewMode === 'month') return getMonthGridDays(selectedDate)
    return []
  }, [viewMode, selectedDate])
  const gridDates = useMemo(() => gridDays.map((day) => day.date), [gridDays])

  const rangeBookings = useMemo(
    () => filterBookingsForRange(bookings, gridDates, effectiveMasterFilter),
    [bookings, gridDates, effectiveMasterFilter],
  )
  // Сетка обязана уважать те же фильтры статуса/оплаты, что и список — та же
  // filterBookingsByVisibility, без изменений.
  const visibleRangeBookings = useMemo(
    () =>
      filterBookingsByVisibility(
        rangeBookings,
        selectedStatuses,
        paidBookingIds,
        isAdmin ? paymentFilter : { showPaid: true, showUnpaid: true },
      ),
    [rangeBookings, selectedStatuses, paidBookingIds, paymentFilter, isAdmin],
  )
  const bookingsByDay = useMemo(
    () => groupBookingsByDay(visibleRangeBookings, gridDates),
    [visibleRangeBookings, gridDates],
  )

  const rangeBlocks = useMemo(
    () => filterBlocksForRange(blocks, gridDates, effectiveMasterFilter),
    [blocks, gridDates, effectiveMasterFilter],
  )
  const blocksByDay = useMemo(() => groupBlocksByDay(rangeBlocks, gridDates), [rangeBlocks, gridDates])

  // Фильтр "Оплачено/Не оплачено" виден только ADMIN (только для него грузятся payments —
  // см. эффект выше), поэтому для MASTER он всегда пропускает всё, как будто оба чекбокса включены.
  const visibleBookings = useMemo(
    () =>
      filterBookingsByVisibility(
        dayBookings,
        selectedStatuses,
        paidBookingIds,
        isAdmin ? paymentFilter : { showPaid: true, showUnpaid: true },
      ),
    [dayBookings, selectedStatuses, paidBookingIds, paymentFilter, isAdmin],
  )

  const toggleStatus = (status: BookingStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const togglePaymentFilter = (key: keyof PaymentVisibilityFilter) => {
    setPaymentFilter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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

  // Перенос по дате из недельной/месячной сетки (drag-and-drop) — время суток и мастер
  // сохраняются, меняется только день (см. shiftIsoToDateOnly). Тот же rescheduleBooking,
  // что уже использует RescheduleModal, никакой новой ручки не нужно. Оптимистичное
  // обновление с откатом — по образцу handleStatusChange/handleDeleteBlock выше.
  const handleGridReschedule = async (booking: Booking, newDate: string) => {
    setActionError(null)
    setBusyBookingId(booking.id)
    const newStartTime = shiftIsoToDateOnly(booking.startTime, newDate)
    const newEndTime = shiftIsoToDateOnly(booking.endTime, newDate)
    const previousBookings = bookings
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, startTime: newStartTime, endTime: newEndTime } : b)),
    )
    try {
      await rescheduleBooking(booking.id, { startTime: newStartTime, masterId: booking.masterId })
      await reloadBookings()
    } catch (error) {
      setBookings(previousBookings)
      setActionError(getApiErrorMessage(error, 'Не удалось перенести запись'))
    } finally {
      setBusyBookingId(null)
    }
  }

  const handleDeleteBlock = async (block: MasterBlock) => {
    setActionError(null)
    setBusyBlockId(block.id)
    try {
      await deleteMasterBlock(block.id)
      await reloadBlocks()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось снять блокировку'))
    } finally {
      setBusyBlockId(null)
    }
  }

  // ADMIN снимает любую блокировку салона, MASTER — только свою (тот же приём, что и в
  // MasterBlocksService.remove на бэкенде — здесь просто скрывает кнопку заранее).
  const canDeleteBlock = (block: MasterBlock) => isAdmin || block.masterId === user?.masterId

  // showMasterName=true только в плоском списке — в колонках "По мастерам" мастер и так
  // ясен из заголовка колонки (см. MasterColumnsView).
  const renderBlockItem = (block: MasterBlock, showMasterName: boolean) => (
    <ScheduleBlockItem
      key={block.id}
      block={block}
      master={mastersById.get(block.masterId)}
      showMasterName={showMasterName}
      canDelete={canDeleteBlock(block)}
      busy={busyBlockId === block.id}
      onDelete={() => void handleDeleteBlock(block)}
    />
  )

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
      currentMasterId={user?.masterId ?? null}
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

        {isAdmin && viewMode !== 'byMaster' && (
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
        <button type="button" onClick={() => setBlockModalOpen(true)}>
          Заблокировать время
        </button>
      </div>

      {/* "Неделя"/"Месяц" доступны и ADMIN, и MASTER (для MASTER — read-only обзор своего
          расписания, см. canDragReschedule=isAdmin ниже); "По мастерам" остаётся ADMIN-only,
          как и раньше. */}
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
          aria-pressed={viewMode === 'week'}
          className={viewMode === 'week' ? 'active' : undefined}
          onClick={() => setViewMode('week')}
        >
          Неделя
        </button>
        <button
          type="button"
          aria-pressed={viewMode === 'month'}
          className={viewMode === 'month' ? 'active' : undefined}
          onClick={() => setViewMode('month')}
        >
          Месяц
        </button>
        {isAdmin && (
          <button
            type="button"
            aria-pressed={viewMode === 'byMaster'}
            className={viewMode === 'byMaster' ? 'active' : undefined}
            onClick={() => setViewMode('byMaster')}
          >
            По мастерам
          </button>
        )}
      </div>

      {(viewMode === 'week' || viewMode === 'month') && (
        <div className="calendar-grid-nav">
          <button
            type="button"
            aria-label="Предыдущий период"
            onClick={() => setSelectedDate((prev) => navigateGridAnchor(prev, viewMode, -1))}
          >
            ‹
          </button>
          <button type="button" onClick={() => setSelectedDate(todayDateOnly())}>
            Сегодня
          </button>
          <button
            type="button"
            aria-label="Следующий период"
            onClick={() => setSelectedDate((prev) => navigateGridAnchor(prev, viewMode, 1))}
          >
            ›
          </button>
        </div>
      )}

      <div className="calendar-filters">
        <fieldset>
          <legend>Статус</legend>
          {ALL_BOOKING_STATUSES.map((status) => (
            <label key={status} className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedStatuses.has(status)}
                onChange={() => toggleStatus(status)}
              />
              {STATUS_LABELS[status]}
            </label>
          ))}
        </fieldset>

        {isAdmin && (
          <fieldset>
            <legend>Оплата</legend>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={paymentFilter.showPaid}
                onChange={() => togglePaymentFilter('showPaid')}
              />
              Оплачено
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={paymentFilter.showUnpaid}
                onChange={() => togglePaymentFilter('showUnpaid')}
              />
              Не оплачено
            </label>
          </fieldset>
        )}
      </div>

      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : viewMode === 'week' || viewMode === 'month' ? (
        <CalendarGridView
          days={gridDays}
          layout={viewMode}
          bookingsByDay={bookingsByDay}
          blocksByDay={blocksByDay}
          clientsById={clientsById}
          mastersById={mastersById}
          servicesById={servicesById}
          paidBookingIds={paidBookingIds}
          role={user!.role}
          canDragReschedule={isAdmin}
          busyBookingId={busyBookingId}
          onReschedule={(booking) => setRescheduleTarget(booking)}
          onDropBooking={(booking, newDate) => void handleGridReschedule(booking, newDate)}
        />
      ) : viewMode === 'byMaster' ? (
        masters.some((master) => master.isActive) ? (
          <MasterColumnsView
            masters={masters}
            bookings={visibleBookings}
            unfilteredBookings={dayBookings}
            renderBooking={renderBookingItem}
            blocksByMasterId={blocksByMasterId}
            renderBlock={(block) => renderBlockItem(block, false)}
          />
        ) : (
          <p>Нет активных мастеров</p>
        )
      ) : dayBookings.length === 0 && dayBlocks.length === 0 ? (
        <p>На эту дату записей нет</p>
      ) : visibleBookings.length === 0 && dayBlocks.length === 0 ? (
        <p>Нет записей, соответствующих выбранным фильтрам</p>
      ) : (
        <ul className="booking-list">
          {dayBlocks.map((block) => renderBlockItem(block, true))}
          {visibleBookings.map((booking) => renderBookingItem(booking))}
        </ul>
      )}

      {createModalOpen && (
        <CreateBookingModal
          clients={clients}
          masters={masters}
          services={services}
          masterServiceLinks={masterServiceLinks}
          defaultDate={selectedDate}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => void reloadBookings()}
          onClientCreated={(client) => setClients((prev) => [client, ...prev])}
        />
      )}

      {blockModalOpen && (
        <BlockTimeModal
          masters={masters}
          defaultDate={selectedDate}
          onClose={() => setBlockModalOpen(false)}
          onCreated={() => void reloadBlocks()}
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
