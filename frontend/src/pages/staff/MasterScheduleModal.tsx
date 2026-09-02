import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../components/Modal'
import { getApiErrorMessage } from '../../api/errors'
import {
  findMasterScheduleConflicts,
  getMasterSchedule,
  upsertMasterSchedule,
} from '../../api/masterSchedules'
import { formatTimeRange, toDateOnly } from '../calendar/dateUtils'
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
import type { Booking } from '../../types/booking'

interface MasterScheduleModalProps {
  master: Master
  onClose: () => void
}

function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

// Настройка регулярного графика мастера (Backlog item28, подзадача №34) — доступ только ADMIN,
// форсируется и на бэкенде (см. MasterSchedulesController), и здесь: кнопка открытия этой модалки
// на StaffDetailPage скрыта за isAdmin, а сам маршрут /staff/:id и так под RequireRole ADMIN.
export function MasterScheduleModal({ master, onClose }: MasterScheduleModalProps) {
  const [{ year, month }, setPeriod] = useState(currentYearMonth)
  const [dayStates, setDayStates] = useState<Map<string, ScheduleDayState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // null = конфликты ещё не проверялись для текущего состояния дней; [] = проверены, их нет.
  const [conflicts, setConflicts] = useState<Booking[] | null>(null)

  const dates = useMemo(() => buildMonthDates(year, month), [year, month])

  useEffect(() => {
    let cancelled = false
    // master.id/year/month сменились без ремаунта модалки — сброс здесь синхронизирует UI
    // с новым async-запросом (тот же приём, что и в StaffDetailPage.tsx)
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)
    setConflicts(null)

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

  const setDayHours = (date: string, field: 'startTime' | 'endTime', value: string) => {
    setConflicts(null)
    setDayStates((prev) => {
      const current = prev.get(date)
      if (!current) return prev
      const next = new Map(prev)
      next.set(date, { ...current, [field]: value })
      return next
    })
  }

  const days = useMemo(() => buildUpsertDays(dayStates), [dayStates])
  const canSave = days.length > 0 && !saving && !loading

  // Перед сохранением графика всегда сперва спрашиваем /master-schedules/conflicts. Если что-то
  // нашлось — не сохраняем молча, а показываем список администратору и ждём повторного клика на
  // "Сохранить, несмотря на конфликты" (conflicts !== null сигналит, что предупреждение уже
  // показано для текущего состояния дней). Полноценный экран разрешения конфликтов
  // (перенести/переназначить запись) — отдельная подзадача №36, сюда не входит.
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
        <ul className="master-schedule-day-list">
          {dates.map((date) => {
            const state: ScheduleDayState = dayStates.get(date) ?? {
              status: 'unset',
              startTime: DEFAULT_START_TIME,
              endTime: DEFAULT_END_TIME,
            }
            const dayNumber = Number(date.slice(-2))

            return (
              <li key={date} className={`master-schedule-day master-schedule-day--${state.status}`}>
                <span className="master-schedule-day-number">{dayNumber}</span>

                <div className="master-schedule-day-toggle">
                  <button
                    type="button"
                    aria-pressed={state.status === 'working'}
                    className={state.status === 'working' ? 'active' : undefined}
                    onClick={() => setDayStatus(date, 'working')}
                  >
                    Рабочий
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.status === 'off'}
                    className={state.status === 'off' ? 'active' : undefined}
                    onClick={() => setDayStatus(date, 'off')}
                  >
                    Выходной
                  </button>
                </div>

                {state.status === 'working' && (
                  <div className="master-schedule-day-hours">
                    <label htmlFor={`schedule-start-${date}`}>
                      С
                      <input
                        id={`schedule-start-${date}`}
                        type="time"
                        value={state.startTime}
                        onChange={(event) => setDayHours(date, 'startTime', event.target.value)}
                      />
                    </label>
                    <label htmlFor={`schedule-end-${date}`}>
                      До
                      <input
                        id={`schedule-end-${date}`}
                        type="time"
                        value={state.endTime}
                        onChange={(event) => setDayHours(date, 'endTime', event.target.value)}
                      />
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {conflicts && conflicts.length > 0 && (
        <div role="alert" className="master-schedule-conflicts">
          <p>
            На даты, которые станут нерабочими, уже есть записи клиентов ({conflicts.length}). Их
            нужно будет перенести или переназначить другому мастеру — сохранение графика их не
            трогает автоматически.
          </p>
          <ul>
            {conflicts.map((booking) => (
              <li key={booking.id}>
                {toDateOnly(booking.startTime)} · {formatTimeRange(booking.startTime, booking.endTime)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saveError && <p role="alert">{saveError}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Отмена
        </button>
        <button type="button" disabled={!canSave} onClick={() => void handleSave()}>
          {saving
            ? 'Сохраняем…'
            : conflicts && conflicts.length > 0
              ? 'Сохранить, несмотря на конфликты'
              : 'Сохранить'}
        </button>
      </div>
    </Modal>
  )
}
