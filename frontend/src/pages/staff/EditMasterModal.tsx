import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { updateMaster } from '../../api/staff'
import { listServiceCategories } from '../../api/serviceCategories'
import { getApiErrorMessage } from '../../api/errors'
import type { ServiceCategoryRef } from '../../types/service'
import type { Master } from '../../types/staff'

interface EditMasterModalProps {
  master: Master
  onClose: () => void
  onUpdated: (master: Master) => void
}

export function EditMasterModal({ master, onClose, onUpdated }: EditMasterModalProps) {
  const [name, setName] = useState(master.name)
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [specializationIds, setSpecializationIds] = useState<Set<string>>(
    new Set(master.specializationCategoryIds),
  )
  const [isActive, setIsActive] = useState(master.isActive)
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

  const canSubmit = Boolean(name.trim()) && specializationIds.size > 0 && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const updated = await updateMaster(master.id, {
        name: name.trim(),
        specializationCategoryIds: Array.from(specializationIds),
        isActive,
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

        <fieldset>
          <legend>Специализация</legend>
          {categories.map((category) => (
            <label key={category.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={specializationIds.has(category.id)}
                onChange={() => toggleSpecialization(category.id)}
              />
              {category.name}
            </label>
          ))}
        </fieldset>

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
