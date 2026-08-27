import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  updateServiceCategory,
} from '../../api/serviceCategories'
import { getApiErrorMessage } from '../../api/errors'
import type { ServiceCategoryRef } from '../../types/service'

interface ManageServiceCategoriesModalProps {
  onClose: () => void
  onChanged: () => void
}

export function ManageServiceCategoriesModal({
  onClose,
  onChanged,
}: ManageServiceCategoriesModalProps) {
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategoryRef | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () =>
    listServiceCategories().then((loaded) => {
      setCategories(loaded)
      onChanged()
    })

  useEffect(() => {
    let cancelled = false
    load()
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Не удалось загрузить категории'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newName.trim()) return

    setCreating(true)
    setActionError(null)
    try {
      await createServiceCategory({ name: newName.trim() })
      setNewName('')
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Не удалось создать категорию'))
    } finally {
      setCreating(false)
    }
  }

  const startEditing = (category: ServiceCategoryRef) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return

    setSavingId(id)
    setActionError(null)
    try {
      await updateServiceCategory(id, { name: editingName.trim() })
      setEditingId(null)
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Не удалось переименовать категорию'))
    } finally {
      setSavingId(null)
    }
  }

  const handlePromote = async (id: string) => {
    setPromotingId(id)
    setActionError(null)
    try {
      await updateServiceCategory(id, { isDefault: true })
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Не удалось назначить категорию дефолтной'))
    } finally {
      setPromotingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteServiceCategory(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Не удалось удалить категорию'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal title="Категории услуг" onClose={onClose}>
      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <ul className="booking-list">
          {categories.map((category) => (
            <li key={category.id} className="booking-item">
              {editingId === category.id ? (
                <div className="booking-item-details">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    aria-label="Название категории"
                    required
                  />
                </div>
              ) : (
                <div className="booking-item-details">
                  <strong>{category.name}</strong>
                  {category.isDefault && <span>По умолчанию</span>}
                </div>
              )}

              <div className="booking-item-actions">
                {editingId === category.id ? (
                  <>
                    <button
                      type="button"
                      disabled={savingId === category.id || !editingName.trim()}
                      onClick={() => void handleRename(category.id)}
                    >
                      {savingId === category.id ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEditing(category)}>
                      Переименовать
                    </button>
                    {!category.isDefault && (
                      <button
                        type="button"
                        disabled={promotingId === category.id}
                        onClick={() => void handlePromote(category.id)}
                      >
                        {promotingId === category.id ? 'Назначаем…' : 'Сделать дефолтной'}
                      </button>
                    )}
                    {!category.isDefault && (
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => setDeleteTarget(category)}
                      >
                        Удалить
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => void handleCreate(event)} className="calendar-toolbar">
        <label htmlFor="new-category-name">
          Новая категория
          <input
            id="new-category-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={!newName.trim() || creating}>
          {creating ? 'Создаём…' : 'Добавить'}
        </button>
      </form>

      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Закрыть
        </button>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Удаление категории"
          message={`Удалить категорию «${deleteTarget.name}»? Услуги и специализации мастеров, привязанные к ней, будут перенесены на категорию по умолчанию.`}
          confirmLabel="Удалить"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Modal>
  )
}
