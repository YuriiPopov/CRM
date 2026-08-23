import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createMaster } from '../../api/staff'
import { registerUser } from '../../api/auth'
import { getApiErrorMessage } from '../../api/errors'
import { SERVICE_CATEGORY_LABELS } from '../../types/service'
import type { ServiceCategory } from '../../types/service'
import type { Master } from '../../types/staff'

interface CreateMasterModalProps {
  onClose: () => void
  onCreated: (master: Master) => void
}

const MIN_PASSWORD_LENGTH = 8

// Создание мастера — это два независимых запроса (POST /staff, затем POST /auth/register
// с role: 'MASTER' и masterId только что созданного мастера — своего "создать мастера с
// логином одним махом" эндпоинта на бэкенде нет). Если второй запрос падает (например, email
// уже занят), Master в БД уже есть — createdMaster хранит его, чтобы повторный submit
// пропускал POST /staff и просто пересылал POST /auth/register с (возможно поправленными)
// email/паролем, а не создавал второго мастера-дубликата.
export function CreateMasterModal({ onClose, onCreated }: CreateMasterModalProps) {
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState<ServiceCategory>('MANICURE_PEDICURE')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createdMaster, setCreatedMaster] = useState<Master | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    Boolean(name.trim() && email.trim()) && password.length >= MIN_PASSWORD_LENGTH && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      let master = createdMaster
      if (!master) {
        master = await createMaster({ name: name.trim(), specialization })
        setCreatedMaster(master)
        onCreated(master)
      }

      await registerUser({ email: email.trim(), password, role: 'MASTER', masterId: master.id })
      onClose()
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          createdMaster ? 'Не удалось создать логин мастера' : 'Не удалось создать мастера',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новый мастер" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        {createdMaster && (
          <p>
            Мастер «{createdMaster.name}» уже создан — осталось создать логин для входа.
          </p>
        )}

        <label htmlFor="master-name">
          Имя
          <input
            id="master-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={Boolean(createdMaster)}
            required
          />
        </label>

        <label htmlFor="master-specialization">
          Специализация
          <select
            id="master-specialization"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value as ServiceCategory)}
            disabled={Boolean(createdMaster)}
          >
            {Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="master-email">
          Email для входа
          <input
            id="master-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label htmlFor="master-password">
          Пароль
          <input
            id="master-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Создаём…' : createdMaster ? 'Создать логин' : 'Создать мастера'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
