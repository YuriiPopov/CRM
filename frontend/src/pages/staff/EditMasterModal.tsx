import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { updateMaster } from '../../api/staff'
import { getApiErrorMessage } from '../../api/errors'
import { SERVICE_CATEGORY_LABELS } from '../../types/service'
import type { ServiceCategory } from '../../types/service'
import type { Master } from '../../types/staff'

interface EditMasterModalProps {
  master: Master
  onClose: () => void
  onUpdated: (master: Master) => void
}

export function EditMasterModal({ master, onClose, onUpdated }: EditMasterModalProps) {
  const [name, setName] = useState(master.name)
  const [specialization, setSpecialization] = useState<ServiceCategory>(master.specialization)
  const [isActive, setIsActive] = useState(master.isActive)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim()) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const updated = await updateMaster(master.id, { name: name.trim(), specialization, isActive })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось сохранить изменения'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Редактирование мастера" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="edit-master-name">
          Имя
          <input
            id="edit-master-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label htmlFor="edit-master-specialization">
          Специализация
          <select
            id="edit-master-specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value as ServiceCategory)}
          >
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox-label">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Активен
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
