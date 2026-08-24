import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClients } from '../api/clients'
import { getApiErrorMessage } from '../api/errors'
import { filterClients } from './clients/filterClients'
import { CreateClientModal } from './clients/CreateClientModal'
import type { Client } from '../types/client'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    listClients()
      .then((data) => {
        if (!cancelled) setClients(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить клиентов'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredClients = useMemo(() => filterClients(clients, query), [clients, query])

  return (
    <section>
      <h1>Клиенты</h1>

      <div className="calendar-toolbar">
        <label htmlFor="client-search">
          Поиск
          <input
            id="client-search"
            type="search"
            placeholder="Имя или телефон"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {/* Просмотр + создание клиентов доступны и ADMIN, и MASTER (Backlog, item19) —
            редактирование/GDPR остаются ADMIN-only и скрыты на карточке клиента отдельно. */}
        <button type="button" onClick={() => setCreateModalOpen(true)}>
          + Новый клиент
        </button>
      </div>

      {loadError && <p role="alert">{loadError}</p>}

      {loading ? (
        <p>Загрузка…</p>
      ) : filteredClients.length === 0 ? (
        <p>{clients.length === 0 ? 'Клиентов пока нет' : 'Ничего не найдено'}</p>
      ) : (
        <ul className="client-list">
          {filteredClients.map((client) => (
            <li key={client.id}>
              <Link to={`/clients/${client.id}`} className="client-list-item">
                <strong>{client.name}</strong>
                <span>{client.phone}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {createModalOpen && (
        <CreateClientModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(client) => setClients((prev) => [client, ...prev])}
        />
      )}
    </section>
  )
}
