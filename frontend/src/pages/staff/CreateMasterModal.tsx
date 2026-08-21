import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createMaster } from '../../api/staff'
import { getApiErrorMessage } from '../../api/errors'
import { SERVICE_CATEGORY_LABELS } from '../../types/service'
import type { ServiceCategory } from '../../types/service'
import type { Master } from '../../types/staff'

interface CreateMasterModalProps {
  onClose: () => void
  onCreated: (master: Master) => void
}

export function CreateMasterModal({ onClose, onCreated }: CreateMasterModalProps) {
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState<ServiceCategory>('MANICURE_PEDICURE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim()) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const master = await createMaster({ name: name.trim(), specialization })
      onCreated(master)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать мастера'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новый мастер" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="master-name">
          Имя
          <input id="master-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label htmlFor="master-specialization">
          Специализация
          <select
            id="master-specialization"
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

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Создаём…' : 'Создать мастера'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
