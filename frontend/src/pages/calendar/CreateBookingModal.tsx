import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../auth/useAuth'
import { createBooking } from '../../api/bookings'
import { getApiErrorMessage } from '../../api/errors'
import { SlotPicker } from './SlotPicker'
import type { AvailableSlot } from '../../api/publicBooking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

interface CreateBookingModalProps {
  clients: Client[]
  masters: Master[]
  services: Service[]
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}

export function CreateBookingModal({
  clients,
  masters,
  services,
  defaultDate,
  onClose,
  onCreated,
}: CreateBookingModalProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [clientId, setClientId] = useState('')
  const [masterId, setMasterId] = useState(isAdmin ? '' : (user?.masterId ?? ''))
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Смена мастера/услуги/даты делает ранее выбранный слот неактуальным — сбрасываем его
  // прямо в обработчике события, а не отдельным эффектом (см. также фикс в AuthContext).
  const handleMasterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMasterId(event.target.value)
    setSelectedSlot(null)
  }

  const handleServiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setServiceId(event.target.value)
    setSelectedSlot(null)
  }

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDate(event.target.value)
    setSelectedSlot(null)
  }

  const canSubmit = Boolean(clientId && masterId && serviceId && selectedSlot) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSlot) return

    setSubmitting(true)
    setError(null)

    try {
      await createBooking({
        clientId,
        masterId,
        serviceId,
        startTime: selectedSlot.startTime,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать запись'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новая запись" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="booking-client">
          Клиент
          <select
            id="booking-client"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            required
          >
            <option value="" disabled>
              Выберите клиента
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.phone})
              </option>
            ))}
          </select>
        </label>

        {isAdmin ? (
          <label htmlFor="booking-master">
            Мастер
            <select id="booking-master" value={masterId} onChange={handleMasterChange} required>
              <option value="" disabled>
                Выберите мастера
              </option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>Мастер: вы</p>
        )}

        <label htmlFor="booking-service">
          Услуга
          <select id="booking-service" value={serviceId} onChange={handleServiceChange} required>
            <option value="" disabled>
              Выберите услугу
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.durationMin} мин)
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="booking-date">
          Дата
          <input id="booking-date" type="date" value={date} onChange={handleDateChange} required />
        </label>

        <fieldset>
          <legend>Время</legend>
          <SlotPicker
            masterId={masterId}
            serviceId={serviceId}
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
            {submitting ? 'Создаём…' : 'Создать запись'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
