import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { rescheduleBooking } from '../../api/bookings'
import { getApiErrorMessage } from '../../api/errors'
import { SlotPicker } from './SlotPicker'
import { toDateOnly } from './dateUtils'
import type { AvailableSlot } from '../../api/publicBooking'
import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

interface RescheduleModalProps {
  booking: Booking
  masters: Master[]
  service: Service | undefined
  onClose: () => void
  onRescheduled: () => void
}

// Только ADMIN (см. RolesGuard бэкенда на PATCH /bookings/:id/reschedule) — услугу сменить нельзя,
// только время и, опционально, мастера; повторно использует SlotPicker для выбора нового времени.
export function RescheduleModal({ booking, masters, service, onClose, onRescheduled }: RescheduleModalProps) {
  const [masterId, setMasterId] = useState(booking.masterId)
  const [date, setDate] = useState(toDateOnly(booking.startTime))
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Смена мастера/даты делает ранее выбранный слот неактуальным — сбрасываем прямо в обработчике
  const handleMasterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMasterId(event.target.value)
    setSelectedSlot(null)
  }

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDate(event.target.value)
    setSelectedSlot(null)
  }

  const canSubmit = Boolean(selectedSlot) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSlot) return

    setSubmitting(true)
    setError(null)

    try {
      await rescheduleBooking(booking.id, { startTime: selectedSlot.startTime, masterId })
      onRescheduled()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось перенести запись'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Перенос записи" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <p>Услуга: {service?.name ?? '—'}</p>

        <label htmlFor="reschedule-master">
          Мастер
          <select id="reschedule-master" value={masterId} onChange={handleMasterChange} required>
            {masters.map((master) => (
              <option key={master.id} value={master.id}>
                {master.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="reschedule-date">
          Новая дата
          <input id="reschedule-date" type="date" value={date} onChange={handleDateChange} required />
        </label>

        <fieldset>
          <legend>Новое время</legend>
          <SlotPicker
            masterId={masterId}
            serviceId={booking.serviceId}
            date={date}
            selectedStartTime={selectedSlot?.startTime ?? null}
            onSelect={setSelectedSlot}
          />
        </fieldset>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Переносим…' : 'Перенести'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
