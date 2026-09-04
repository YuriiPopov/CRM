import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { getApiErrorMessage } from '../../api/errors'
import { rescheduleBooking } from '../../api/bookings'
import {
  findMasterScheduleConflicts,
  getMasterSchedule,
  upsertMasterSchedule,
} from '../../api/masterSchedules'
import { RescheduleModal } from '../calendar/RescheduleModal'
import { formatTimeRange, toDateOnly } from '../calendar/dateUtils'
import { getMonthGridDays } from '../calendar/calendarGrid'
import { TIMELINE_END_HOUR, TIMELINE_START_HOUR } from '../dashboard/timeline'
import {
  buildDayStates,
  buildMonthDates,
  buildUpsertDays,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  formatMonthLabel,
  shiftMonth,
} from './masterScheduleGrid'
import type { ScheduleDayState } from './masterScheduleGrid'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'
import type { Booking } from '../../types/booking'

const WEEKDAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const UNSET_STATE: ScheduleDayState = { status: 'unset', startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME }

// item52 — часы работы салона (те же 09:00–19:00, что и TIMELINE_START_HOUR/TIMELINE_END_HOUR
// в dashboard/timeline.ts), чтобы admin не мог указать время вне часов салона в графике мастера.
const SALON_OPEN_TIME = `${String(TIMELINE_START_HOUR).padStart(2, '0')}:00`
const SALON_CLOSE_TIME = `${String(TIMELINE_END_HOUR).padStart(2, '0')}:00`

// Заголовок попапа дня — краткая дата без года (сетка уже показывает месяц/год в шапке модалки).
function formatDayHeading(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

interface MasterScheduleModalProps {
  master: Master
  // Полный список мастеров салона (не только этот) — нужен для переноса (RescheduleModal) и для
  // выбора мастера при переназначении конфликтующей записи (см. item28, подзадача №36).
  masters: Master[]
  // Для отображения услуги в RescheduleModal при переносе конфликтующей записи.
  services: Service[]
  onClose: () => void
}

function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

// Настройка регулярного графика мастера (Backlog item28, подзадача №34) — доступ только ADMIN,
// форсируется и на бэкенде (см. MasterSchedulesController), и здесь: кнопка открытия этой модалки
// на StaffDetailPage скрыта за isAdmin, а сам маршрут /staff/:id и так под RequireRole ADMIN.
export function MasterScheduleModal({ master, masters, services, onClose }: MasterScheduleModalProps) {
  const [{ year, month }, setPeriod] = useState(currentYearMonth)
  const [dayStates, setDayStates] = useState<Map<string, ScheduleDayState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // null = конфликты ещё не проверялись для текущего состояния дней; [] = проверены и/или все
  // разрешены (перенесены/переназначены) — см. handleBookingResolved.
  const [conflicts, setConflicts] = useState<Booking[] | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)
  const [reassigningBookingId, setReassigningBookingId] = useState<string | null>(null)
  const [reassignMasterId, setReassignMasterId] = useState('')
  const [resolvingBookingId, setResolvingBookingId] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  // Дата, для которой сейчас открыт попап с переключателями "Рабочий"/"Выходной" и часами
  // (item38) — null, когда попап закрыт. Ячейки соседних месяцев сюда никогда не попадают.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const gridDays = useMemo(
    () => getMonthGridDays(`${year}-${String(month).padStart(2, '0')}-01`),
    [year, month],
  )
  const servicesById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services])
  const otherActiveMasters = useMemo(
    () => masters.filter((m) => m.isActive && m.id !== master.id),
    [masters, master.id],
  )

  useEffect(() => {
    let cancelled = false
    // master.id/year/month сменились без ремаунта модалки — сброс здесь синхронизирует UI
    // с новым async-запросом (тот же приём, что и в StaffDetailPage.tsx)
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)
    setConflicts(null)
    setSelectedDate(null)

    getMasterSchedule(master.id, year, month)
      .then((records) => {
        if (!cancelled) setDayStates(buildDayStates(buildMonthDates(year, month), records))
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить график'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [master.id, year, month])

  const setDayStatus = (date: string, status: 'working' | 'off') => {
    setConflicts(null)
    setDayStates((prev) => {
      const next = new Map(prev)
      const current = next.get(date)
      next.set(date, {
        status,
        startTime: current?.startTime ?? DEFAULT_START_TIME,
        endTime: current?.endTime ?? DEFAULT_END_TIME,
      })
      return next
    })
  }

  // item52 — min/max на <input type="time"> ограничивают выбор через нативный пикер, но ручной
  // ввод (или значение из старой записи до этого ограничения) может всё же оказаться вне часов
  // салона — обрезаем по границам здесь. Строки "HH:MM" с ведущими нулями сравнимы лексикографически,
  // отдельный парсинг в минуты не нужен.
  const clampToSalonHours = (value: string) => {
    if (value < SALON_OPEN_TIME) return SALON_OPEN_TIME
    if (value > SALON_CLOSE_TIME) return SALON_CLOSE_TIME
    return value
  }

  const setDayHours = (date: string, field: 'startTime' | 'endTime', value: string) => {
    setConflicts(null)
    setDayStates((prev) => {
      const current = prev.get(date)
      if (!current) return prev
      const next = new Map(prev)
      next.set(date, { ...current, [field]: value ? clampToSalonHours(value) : value })
      return next
    })
  }

  const days = useMemo(() => buildUpsertDays(dayStates), [dayStates])
  const selectedState = selectedDate ? dayStates.get(selectedDate) ?? UNSET_STATE : null
  const hasUnresolvedConflicts = (conflicts?.length ?? 0) > 0
  const canSave = days.length > 0 && !saving && !loading && !hasUnresolvedConflicts

  // Перед сохранением графика всегда сперва спрашиваем /master-schedules/conflicts. Если что-то
  // нашлось — сохранение блокируется (см. canSave), пока по каждой конфликтующей записи не будет
  // принято решение (перенос или переназначение — см. handleBookingResolved/handleReassign). Раз
  // conflicts к этому моменту уже не null, повторного запроса /conflicts не требуется — локально
  // известно, что список пуст.
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const payload = { masterId: master.id, year, month, days }

    try {
      if (conflicts === null) {
        const found = await findMasterScheduleConflicts(payload)
        if (found.length > 0) {
          setConflicts(found)
          return
        }
      }
      await upsertMasterSchedule(payload)
      onClose()
    } catch (error) {
      setSaveError(getApiErrorMessage(error, 'Не удалось сохранить график'))
    } finally {
      setSaving(false)
    }
  }

  // Конфликтующая запись перенесена/переназначена — убираем её из списка; когда список
  // опустеет, кнопка "Сохранить" разблокируется (см. canSave).
  const handleBookingResolved = (bookingId: string) => {
    setConflicts((prev) => (prev ? prev.filter((b) => b.id !== bookingId) : prev))
    setReassigningBookingId(null)
    setReassignMasterId('')
  }

  const handleReassign = async (booking: Booking) => {
    if (!reassignMasterId) return

    setResolvingBookingId(booking.id)
    setResolveError(null)
    try {
      await rescheduleBooking(booking.id, { startTime: booking.startTime, masterId: reassignMasterId })
      handleBookingResolved(booking.id)
    } catch (error) {
      setResolveError(getApiErrorMessage(error, 'Не удалось переназначить запись'))
    } finally {
      setResolvingBookingId(null)
    }
  }

  return (
    <Modal title={`График работы: ${master.name}`} onClose={onClose}>
      <div className="master-schedule-nav">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => setPeriod((prev) => shiftMonth(prev.year, prev.month, -1))}
        >
          ‹
        </button>
        <strong>{formatMonthLabel(year, month)}</strong>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => setPeriod((prev) => shiftMonth(prev.year, prev.month, 1))}
        >
          ›
        </button>
      </div>

      {loadError && <p role="alert">{loadError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <div className="master-schedule-grid">
          <div className="master-schedule-grid-weekdays">
            {WEEKDAY_HEADERS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          <div className="master-schedule-grid-cells">
            {gridDays.map((day) => {
              if (!day.isCurrentPeriod) {
                return <div key={day.date} className="master-schedule-grid-cell master-schedule-grid-cell--empty" />
              }

              const state: ScheduleDayState = dayStates.get(day.date) ?? UNSET_STATE
              const dayNumber = Number(day.date.slice(-2))
              const isSelected = day.date === selectedDate

              return (
                <button
                  key={day.date}
                  type="button"
                  aria-label={`День ${dayNumber}`}
                  aria-haspopup="dialog"
                  aria-expanded={isSelected}
                  className={[
                    'master-schedule-grid-cell',
                    `master-schedule-grid-cell--${state.status}`,
                    isSelected && 'master-schedule-grid-cell--selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedDate((prev) => (prev === day.date ? null : day.date))}
                >
                  <span className="master-schedule-grid-cell-number">{dayNumber}</span>
                  {state.status === 'working' && (
                    <span className="master-schedule-grid-cell-hours">
                      {state.startTime}–{state.endTime}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedDate && selectedState && (
        <div className="master-schedule-day-popover" role="dialog" aria-label={`Настройки дня — ${formatDayHeading(selectedDate)}`}>
          <div className="master-schedule-day-popover-header">
            <strong>{formatDayHeading(selectedDate)}</strong>
            <button type="button" aria-label="Закрыть" onClick={() => setSelectedDate(null)}>
              ×
            </button>
          </div>

          <div className="master-schedule-day-toggle">
            <button
              type="button"
              aria-pressed={selectedState.status === 'working'}
              className={selectedState.status === 'working' ? 'active' : undefined}
              onClick={() => setDayStatus(selectedDate, 'working')}
            >
              Рабочий
            </button>
            <button
              type="button"
              aria-pressed={selectedState.status === 'off'}
              className={selectedState.status === 'off' ? 'active' : undefined}
              onClick={() => setDayStatus(selectedDate, 'off')}
            >
              Выходной
            </button>
          </div>

          {selectedState.status === 'working' && (
            <div className="master-schedule-day-hours">
              <label htmlFor={`schedule-start-${selectedDate}`}>
                С
                <input
                  id={`schedule-start-${selectedDate}`}
                  type="time"
                  min={SALON_OPEN_TIME}
                  max={SALON_CLOSE_TIME}
                  value={selectedState.startTime}
                  onChange={(event) => setDayHours(selectedDate, 'startTime', event.target.value)}
                />
              </label>
              <label htmlFor={`schedule-end-${selectedDate}`}>
                До
                <input
                  id={`schedule-end-${selectedDate}`}
                  type="time"
                  min={SALON_OPEN_TIME}
                  max={SALON_CLOSE_TIME}
                  value={selectedState.endTime}
                  onChange={(event) => setDayHours(selectedDate, 'endTime', event.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {conflicts && conflicts.length > 0 && (
        <div className="master-schedule-conflicts">
          <p role="alert">
            На даты, которые станут нерабочими, уже есть записи клиентов ({conflicts.length}).
            Перенесите или переназначьте каждую другому мастеру, прежде чем сохранить график.
          </p>
          <ul>
            {conflicts.map((conflictBooking) => (
              <li key={conflictBooking.id} className="master-schedule-conflict-item">
                <div className="master-schedule-conflict-summary">
                  <span>
                    {toDateOnly(conflictBooking.startTime)} ·{' '}
                    {formatTimeRange(conflictBooking.startTime, conflictBooking.endTime)}
                  </span>
                  <span>{servicesById.get(conflictBooking.serviceId)?.name ?? 'Услуга не найдена'}</span>
                </div>

                <div className="master-schedule-conflict-actions">
                  <button type="button" onClick={() => setRescheduleTarget(conflictBooking)}>
                    Перенести
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReassigningBookingId((prev) =>
                        prev === conflictBooking.id ? null : conflictBooking.id,
                      )
                    }
                  >
                    Переназначить другому мастеру
                  </button>
                </div>

                {reassigningBookingId === conflictBooking.id && (
                  <div className="master-schedule-conflict-reassign">
                    <label htmlFor={`reassign-master-${conflictBooking.id}`}>
                      Новый мастер
                      <select
                        id={`reassign-master-${conflictBooking.id}`}
                        value={reassignMasterId}
                        onChange={(event) => setReassignMasterId(event.target.value)}
                      >
                        <option value="" disabled>
                          Выберите мастера
                        </option>
                        {otherActiveMasters.map((otherMaster) => (
                          <option key={otherMaster.id} value={otherMaster.id}>
                            {otherMaster.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!reassignMasterId || resolvingBookingId === conflictBooking.id}
                      onClick={() => void handleReassign(conflictBooking)}
                    >
                      {resolvingBookingId === conflictBooking.id ? 'Переназначаем…' : 'Подтвердить'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {resolveError && <p role="alert">{resolveError}</p>}
        </div>
      )}

      {saveError && <p role="alert">{saveError}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Отмена
        </button>
        <div>
          {hasUnresolvedConflicts && <p className="master-schedule-conflict-hint">Сначала решите конфликты</p>}
          <button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          masters={[master, ...otherActiveMasters]}
          service={servicesById.get(rescheduleTarget.serviceId)}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={() => handleBookingResolved(rescheduleTarget.id)}
        />
      )}
    </Modal>
  )
}
