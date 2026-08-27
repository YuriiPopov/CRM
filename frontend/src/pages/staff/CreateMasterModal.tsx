import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createMaster } from '../../api/staff'
import { registerUser } from '../../api/auth'
import { listServiceCategories } from '../../api/serviceCategories'
import { getApiErrorMessage } from '../../api/errors'
import type { ServiceCategoryRef } from '../../types/service'
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
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [specializationIds, setSpecializationIds] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createdMaster, setCreatedMaster] = useState<Master | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listServiceCategories()
      .then((loaded) => {
        if (!cancelled) setCategories(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Не удалось загрузить категории'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleSpecialization = (categoryId: string) => {
    setSpecializationIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const canSubmit =
    Boolean(name.trim() && email.trim()) &&
    specializationIds.size > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      let master = createdMaster
      if (!master) {
        master = await createMaster({
          name: name.trim(),
          specializationCategoryIds: Array.from(specializationIds),
        })
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

        <fieldset>
          <legend>Специализация</legend>
          {categories.map((category) => (
            <label key={category.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={specializationIds.has(category.id)}
                onChange={() => toggleSpecialization(category.id)}
                disabled={Boolean(createdMaster)}
              />
              {category.name}
            </label>
          ))}
        </fieldset>

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
