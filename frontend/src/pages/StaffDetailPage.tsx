import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { assignService, getMaster, unassignService } from '../api/staff'
import { listServices } from '../api/services'
import { listServiceCategories } from '../api/serviceCategories'
import { getApiErrorMessage } from '../api/errors'
import { EditMasterModal } from './staff/EditMasterModal'
import type { Service, ServiceCategoryRef } from '../types/service'
import type { MasterDetail } from '../types/staff'

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [master, setMaster] = useState<MasterDetail | null>(null)
  const [allServices, setAllServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [serviceToAssign, setServiceToAssign] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [detachingServiceId, setDetachingServiceId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return Promise.resolve()
    return getMaster(id).then(setMaster)
  }, [id])

  useEffect(() => {
    let cancelled = false
    // id из useParams() может смениться без ремаунта — сброс здесь синхронизирует UI
    // с новым async-запросом (см. аналогичный комментарий в ClientDetailPage.tsx)
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)

    const requests: Promise<unknown>[] = [load(), listServiceCategories().then(setCategories)]
    if (isAdmin) {
      requests.push(listServices().then(setAllServices))
    }

    Promise.all(requests)
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить мастера'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [load, isAdmin])

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const attachedServiceIds = useMemo(
    () => new Set(master?.services.map((service) => service.id) ?? []),
    [master],
  )
  const availableToAssign = useMemo(
    () => allServices.filter((service) => !attachedServiceIds.has(service.id)),
    [allServices, attachedServiceIds],
  )

  // Привязка идемпотентна на бэкенде (upsert) — но дропдаун и так исключает уже привязанные
  // услуги, так что повторный вызов на одну и ту же пару тут просто не может случиться из UI.
  const handleAssign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || !serviceToAssign) return

    setAssigning(true)
    setActionError(null)
    try {
      await assignService(id, serviceToAssign)
      setServiceToAssign('')
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось привязать услугу'))
    } finally {
      await load()
      setAssigning(false)
    }
  }

  // Перезагружаем список и при ошибке тоже — 404 обычно значит, что связь уже сняли
  // (например, из другой вкладки), и локальный список должен догнать реальное состояние.
  const handleUnassign = async (serviceId: string) => {
    if (!id) return

    setDetachingServiceId(serviceId)
    setActionError(null)
    try {
      await unassignService(id, serviceId)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось отвязать услугу'))
    } finally {
      await load()
      setDetachingServiceId(null)
    }
  }

  if (loading) {
    return <p>Загрузка…</p>
  }

  if (loadError || !master) {
    return (
      <section>
        <p role="alert">{loadError ?? 'Мастер не найден'}</p>
        <Link to="/staff">← К списку мастеров</Link>
      </section>
    )
  }

  return (
    <section>
      <p>
        <Link to="/staff">← К списку мастеров</Link>
      </p>

      <h1>{master.name}</h1>

      {actionError && <p role="alert">{actionError}</p>}

      <dl className="client-card">
        <dt>Специализация</dt>
        <dd>
          {master.specializationCategoryIds
            .map((catId) => categoriesById.get(catId)?.name)
            .filter(Boolean)
            .join(', ')}
        </dd>
        <dt>Статус</dt>
        <dd>{master.isActive ? 'Активен' : 'Неактивен'}</dd>
      </dl>

      {isAdmin && (
        <div className="modal-actions client-actions">
          <button type="button" onClick={() => setEditModalOpen(true)}>
            Редактировать
          </button>
        </div>
      )}

      <h2>Привязанные услуги</h2>
      {master.services.length === 0 ? (
        <p>Услуги не привязаны</p>
      ) : (
        <ul className="booking-list">
          {master.services.map((service) => (
            <li key={service.id} className="booking-item">
              <div className="booking-item-details">
                <strong>{service.name}</strong>
                <span>{categoriesById.get(service.categoryId)?.name ?? '—'}</span>
                <span>
                  {service.durationMin} мин · {service.price}
                </span>
              </div>
              {isAdmin && (
                <div className="booking-item-actions">
                  <button
                    type="button"
                    disabled={detachingServiceId === service.id}
                    onClick={() => void handleUnassign(service.id)}
                  >
                    {detachingServiceId === service.id ? 'Отвязываем…' : 'Отвязать'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={(event) => void handleAssign(event)} className="calendar-toolbar">
          <label htmlFor="assign-service-select">
            Привязать услугу
            <select
              id="assign-service-select"
              value={serviceToAssign}
              onChange={(event) => setServiceToAssign(event.target.value)}
            >
              <option value="">
                {availableToAssign.length === 0 ? 'Все услуги уже привязаны' : 'Выберите услугу'}
              </option>
              {availableToAssign.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!serviceToAssign || assigning}>
            {assigning ? 'Привязываем…' : 'Привязать'}
          </button>
        </form>
      )}

      {editModalOpen && (
        <EditMasterModal
          master={master}
          onClose={() => setEditModalOpen(false)}
          onUpdated={() => void load()}
        />
      )}
    </section>
  )
}
