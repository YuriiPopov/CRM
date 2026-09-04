import { useEffect, useState } from 'react'
import { getAvailableSlots } from '../../api/publicBooking'
import type { AvailableSlot } from '../../api/publicBooking'
import { getApiErrorMessage } from '../../api/errors'
import { formatTime } from './dateUtils'

interface SlotPickerProps {
  masterId: string
  serviceId: string
  date: string
  selectedStartTime: string | null
  onSelect: (slot: AvailableSlot) => void
}

// Общий выбор свободного времени и для создания, и для переноса записи — переиспользует
// публичный GET /public/booking/slots (см. api/publicBooking.ts).
export function SlotPicker({ masterId, serviceId, date, selectedStartTime, onSelect }: SlotPickerProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  // item51 — недоступность мастера по графику работ (MasterSchedule) на весь день; true по
  // умолчанию, т.к. до первого ответа сервера не показывается ни список, ни это сообщение
  // (см. статус loading/idle ниже).
  const [isWorkingDay, setIsWorkingDay] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Рендер уже скрывает список слотов, пока не выбраны мастер/услуга (см. return ниже) —
    // сбрасывать slots здесь незачем, устаревшее значение всё равно не отображается.
    if (!masterId || !serviceId || !date) {
      return
    }

    let cancelled = false
    // Легитимный случай (в отличие от фикса выше): статус отслеживает реальный async-запрос,
    // "loading" нужно выставить синхронно до его завершения — это не производимое из пропсов значение.
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('loading')
    setError(null)

    getAvailableSlots(masterId, serviceId, date)
      .then((response) => {
        if (cancelled) return
        setSlots(response.slots)
        setIsWorkingDay(response.isWorkingDay)
        setStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSlots([])
        setError(getApiErrorMessage(err, 'Не удалось загрузить доступное время'))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [masterId, serviceId, date])

  if (!masterId || !serviceId) {
    return <p className="slot-picker-hint">Выберите мастера и услугу, чтобы увидеть доступное время</p>
  }

  if (status === 'loading') {
    return <p>Загрузка доступного времени…</p>
  }

  if (status === 'error') {
    return <p role="alert">{error}</p>
  }

  // item51 — полный выходной по графику работ (MasterSchedule.isWorking: false) на выбранную
  // дату: список слотов вообще не показываем, только эта надпись — независимо от slots (сервер
  // и так возвращает для этого случая пустой список, см. PublicBookingService.getAvailableSlots).
  if (!isWorkingDay) {
    return <p>Мастер в этот день недоступен</p>
  }

  if (slots.length === 0) {
    return <p>На эту дату свободных слотов нет</p>
  }

  return (
    <ul className="slot-picker-list" aria-label="Доступное время">
      {slots.map((slot) => (
        <li key={slot.startTime}>
          <button
            type="button"
            aria-pressed={selectedStartTime === slot.startTime}
            className={
              selectedStartTime === slot.startTime ? 'slot-button slot-button-selected' : 'slot-button'
            }
            onClick={() => onSelect(slot)}
          >
            {formatTime(slot.startTime)}
          </button>
        </li>
      ))}
    </ul>
  )
}
