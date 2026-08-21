import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { updateService } from '../../api/services'
import { getApiErrorMessage } from '../../api/errors'
import { SERVICE_CATEGORY_LABELS } from '../../types/service'
import type { Service, ServiceCategory } from '../../types/service'

interface EditServiceModalProps {
  service: Service
  onClose: () => void
  onUpdated: (service: Service) => void
}

export function EditServiceModal({ service, onClose, onUpdated }: EditServiceModalProps) {
  const [name, setName] = useState(service.name)
  const [category, setCategory] = useState<ServiceCategory>(service.category)
  const [durationMin, setDurationMin] = useState(String(service.durationMin))
  const [price, setPrice] = useState(String(service.price))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim() && durationMin && price) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const updated = await updateService(service.id, {
        name: name.trim(),
        category,
        durationMin: Number(durationMin),
        price: Number(price),
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось сохранить изменения'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Редактирование услуги" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="edit-service-name">
          Название
          <input
            id="edit-service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label htmlFor="edit-service-category">
          Категория
          <select
            id="edit-service-category"
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

        <label htmlFor="edit-service-duration">
          Длительность (мин)
          <input
            id="edit-service-duration"
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            required
          />
        </label>

        <label htmlFor="edit-service-price">
          Цена
          <input
            id="edit-service-price"
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
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
