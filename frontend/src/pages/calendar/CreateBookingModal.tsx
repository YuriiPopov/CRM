import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../auth/useAuth'
import { createBooking } from '../../api/bookings'
import { getApiErrorMessage } from '../../api/errors'
import { SlotPicker } from './SlotPicker'
import { CreateClientModal } from '../clients/CreateClientModal'
import { filterMastersForService, filterServicesForMaster, isMasterServiceLinked } from './masterServiceFilter'
import type { AvailableSlot } from '../../api/publicBooking'
import type { Client } from '../../types/client'
import type { Master, MasterServiceLink } from '../../types/staff'
import type { Service } from '../../types/service'

interface CreateBookingModalProps {
  clients: Client[]
  masters: Master[]
  services: Service[]
  masterServiceLinks: MasterServiceLink[]
  defaultDate: string
  onClose: () => void
  onCreated: () => void
  onClientCreated: (client: Client) => void
}

export function CreateBookingModal({
  clients,
  masters,
  services,
  masterServiceLinks,
  defaultDate,
  onClose,
  onCreated,
  onClientCreated,
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
  // Инлайн-создание клиента прямо из формы записи (Backlog п.5) — актуально в первую очередь
  // для MASTER, у которого нет вкладки "Клиенты", но кнопка доступна и ADMIN как удобство.
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false)

  // Взаимная фильтрация мастер↔услуга — для ADMIN сужает оба списка друг под друга; для
  // MASTER мастер фиксирован (не select), а услуги сужаются до тех, что привязаны к нему
  // через MasterService (masterServiceLinks грузится в CalendarPage и для MASTER тоже, см. там).
  const availableMasters = isAdmin ? filterMastersForService(masters, masterServiceLinks, serviceId) : masters
  const availableServices = isAdmin
    ? filterServicesForMaster(services, masterServiceLinks, masterId)
    : filterServicesForMaster(services, masterServiceLinks, user?.masterId ?? '')

  // Смена мастера/услуги/даты делает ранее выбранный слот неактуальным — сбрасываем его
  // прямо в обработчике события, а не отдельным эффектом (см. также фикс в AuthContext).
  //
  // Проверка isMasterServiceLinked ниже — защитный код: раз оба списка сужают друг друга
  // синхронно и живьём (availableMasters/availableServices выше), любой вариант, доступный
  // для выбора в <select>, уже гарантированно совместим с текущим значением другого поля —
  // так что на практике эта ветка недостижима через реальный клик. Оставлена как страховка
  // на случай будущих изменений в модели фильтрации.
  const handleMasterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newMasterId = event.target.value
    setMasterId(newMasterId)
    setSelectedSlot(null)

    if (isAdmin && serviceId && newMasterId && !isMasterServiceLinked(masterServiceLinks, newMasterId, serviceId)) {
      setServiceId('')
    }
  }

  const handleServiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newServiceId = event.target.value
    setServiceId(newServiceId)
    setSelectedSlot(null)

    if (isAdmin && masterId && newServiceId && !isMasterServiceLinked(masterServiceLinks, masterId, newServiceId)) {
      setMasterId('')
    }
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

        {/* Единственный способ завести нового клиента для MASTER (вкладка "Клиенты" ему
            недоступна, см. AppRoutes) — доступно и ADMIN как более быстрый путь из формы записи. */}
        <button type="button" onClick={() => setCreateClientModalOpen(true)}>
          + Новый клиент
        </button>

        {isAdmin ? (
          <label htmlFor="booking-master">
            Мастер
            <select id="booking-master" value={masterId} onChange={handleMasterChange} required>
              <option value="" disabled>
                Выберите мастера
              </option>
              {availableMasters.map((master) => (
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
            {availableServices.map((service) => (
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

      {createClientModalOpen && (
        <CreateClientModal
          onClose={() => setCreateClientModalOpen(false)}
          onCreated={(client) => {
            onClientCreated(client)
            setClientId(client.id)
          }}
        />
      )}
    </Modal>
  )
}
