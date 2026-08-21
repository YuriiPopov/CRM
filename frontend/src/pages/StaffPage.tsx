import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { listStaff } from '../api/staff'
import { getApiErrorMessage } from '../api/errors'
import { filterStaff } from './staff/filterStaff'
import { CreateMasterModal } from './staff/CreateMasterModal'
import { SERVICE_CATEGORY_LABELS } from '../types/service'
import type { Master } from '../types/staff'

// ADMIN видит весь штат салона; MASTER — только свою карточку (уже скоуплено бэкендом, GET /staff)
export function StaffPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [masters, setMasters] = useState<Master[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    listStaff()
      .then((data) => {
        if (!cancelled) setMasters(data)
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

  const filteredMasters = useMemo(() => filterStaff(masters, query), [masters, query])

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

      {loadError && <p role="alert">{loadError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : filteredMasters.length === 0 ? (
        <p>{masters.length === 0 ? 'Мастеров пока нет' : 'Ничего не найдено'}</p>
      ) : (
        <ul className="client-list">
          {filteredMasters.map((master) => (
            <li key={master.id}>
              <Link to={`/staff/${master.id}`} className="client-list-item">
                <strong>{master.name}</strong>
                <span>{SERVICE_CATEGORY_LABELS[master.specialization]}</span>
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
