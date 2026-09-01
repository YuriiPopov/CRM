import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { listStaff } from '../api/staff'
import { listServiceCategories } from '../api/serviceCategories'
import { getApiErrorMessage } from '../api/errors'
import { filterStaff } from './staff/filterStaff'
import { CreateMasterModal } from './staff/CreateMasterModal'
import type { ServiceCategoryRef } from '../types/service'
import type { Master } from '../types/staff'

// ADMIN видит весь штат салона; MASTER — только свою карточку (уже скоуплено бэкендом, GET /staff)
export function StaffPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [masters, setMasters] = useState<Master[]>([])
  const [categories, setCategories] = useState<ServiceCategoryRef[]>([])
  const [query, setQuery] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([listStaff(), listServiceCategories()])
      .then(([staff, loadedCategories]) => {
        if (!cancelled) {
          setMasters(staff)
          setCategories(loadedCategories)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить мастеров'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const filteredMasters = useMemo(
    () => filterStaff(masters, query, selectedCategoryIds, includeInactive),
    [masters, query, selectedCategoryIds, includeInactive],
  )

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  return (
    <section>
      <h1>Мастера</h1>

      <div className="calendar-toolbar">
        <label htmlFor="master-search">
          Поиск
          <input
            id="master-search"
            type="search"
            placeholder="Имя"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {isAdmin && (
          <button type="button" onClick={() => setCreateModalOpen(true)}>
            + Новый мастер
          </button>
        )}
      </div>

      <div className="calendar-filters">
        {categories.length > 0 && (
          <fieldset>
            <legend>Категории</legend>
            {categories.map((category) => (
              <label key={category.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.has(category.id)}
                  onChange={() => toggleCategoryFilter(category.id)}
                />
                {category.name}
              </label>
            ))}
          </fieldset>
        )}

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Показывать неактивных
        </label>
      </div>

      {loadError && <p role="alert">{loadError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : filteredMasters.length === 0 ? (
        <p>{masters.length === 0 ? 'Мастеров пока нет' : 'Ничего не найдено'}</p>
      ) : (
        <ul className="client-list">
          {filteredMasters.map((master) => (
            <li key={master.id}>
              <Link
                to={`/staff/${master.id}`}
                className={
                  master.isActive ? 'client-list-item' : 'client-list-item client-list-item--inactive'
                }
              >
                <strong>{master.name}</strong>
                <span>
                  {master.specializationCategoryIds
                    .map((id) => categoriesById.get(id)?.name)
                    .filter(Boolean)
                    .join(', ')}
                </span>
                {!master.isActive && <span>Неактивен</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {createModalOpen && (
        <CreateMasterModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(master) => setMasters((prev) => [master, ...prev])}
        />
      )}
    </section>
  )
}
