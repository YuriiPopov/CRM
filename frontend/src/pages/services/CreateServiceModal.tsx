import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createService } from '../../api/services'
import { getApiErrorMessage } from '../../api/errors'
import { SERVICE_CATEGORY_LABELS } from '../../types/service'
import type { Service, ServiceCategory } from '../../types/service'

interface CreateServiceModalProps {
  onClose: () => void
  onCreated: (service: Service) => void
}

export function CreateServiceModal({ onClose, onCreated }: CreateServiceModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ServiceCategory>('MANICURE_PEDICURE')
  const [durationMin, setDurationMin] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim() && durationMin && price) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const service = await createService({
        name: name.trim(),
        category,
        durationMin: Number(durationMin),
        price: Number(price),
      })
      onCreated(service)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать услугу'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новая услуга" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="service-name">
          Название
          <input id="service-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label htmlFor="service-category">
          Категория
          <select
            id="service-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory)}
          >
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="service-duration">
          Длительность (мин)
          <input
            id="service-duration"
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            required
          />
        </label>

        <label htmlFor="service-price">
          Цена
          <input
            id="service-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Создаём…' : 'Создать услугу'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
