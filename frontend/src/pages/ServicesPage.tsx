import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { deleteService, listServices } from '../api/services'
import { getApiErrorMessage } from '../api/errors'
import { filterServices } from './services/filterServices'
import { CreateServiceModal } from './services/CreateServiceModal'
import { EditServiceModal } from './services/EditServiceModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SERVICE_CATEGORY_LABELS } from '../types/service'
import type { Service } from '../types/service'

// Доступно и ADMIN, и MASTER (см. AppRoutes) — ADMIN получает CRUD, MASTER только читает каталог,
// как и на бэкенде (GET /services не различает роли, изменяющие маршруты — ADMIN-only).
export function ServicesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [services, setServices] = useState<Service[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => listServices().then(setServices), [])

  useEffect(() => {
    let cancelled = false
    load()
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить услуги'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load])

  const filteredServices = useMemo(() => filterServices(services, query), [services, query])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteService(deleteTarget.id)
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить услугу'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section>
      <h1>Услуги</h1>

      <div className="calendar-toolbar">
        <label htmlFor="service-search">
          Поиск
          <input
            id="service-search"
            type="search"
            placeholder="Название"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {isAdmin && (
          <button type="button" onClick={() => setCreateModalOpen(true)}>
            + Новая услуга
          </button>
        )}
      </div>

      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : filteredServices.length === 0 ? (
        <p>{services.length === 0 ? 'Услуг пока нет' : 'Ничего не найдено'}</p>
      ) : (
        <ul className="booking-list">
          {filteredServices.map((service) => (
            <li key={service.id} className="booking-item">
              <div className="booking-item-details">
                <strong>{service.name}</strong>
                <span>{SERVICE_CATEGORY_LABELS[service.category]}</span>
                <span>
                  {service.durationMin} мин · {service.price}
                </span>
              </div>
              {isAdmin && (
                <div className="booking-item-actions">
                  <button type="button" onClick={() => setEditTarget(service)}>
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => setDeleteTarget(service)}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {createModalOpen && (
        <CreateServiceModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(service) => setServices((prev) => [service, ...prev])}
        />
      )}

      {editTarget && (
        <EditServiceModal
          service={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={(service) =>
            setServices((prev) => prev.map((s) => (s.id === service.id ? service : s)))
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Удаление услуги"
          message={`Удалить услугу «${deleteTarget.name}»? Если она ещё используется мастерами, материалами или записями, удаление будет отклонено.`}
          confirmLabel="Удалить"
          busy={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  )
}
