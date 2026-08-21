import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { eraseClientData, exportClientData } from '../api/clients'
import { listStaff } from '../api/staff'
import { getApiErrorMessage } from '../api/errors'
import { formatTimeRange, toDateOnly } from './calendar/dateUtils'
import { STATUS_LABELS } from './calendar/statusTransitions'
import { EditClientModal } from './clients/EditClientModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { downloadJson } from '../utils/downloadJson'
import { isFullPayment } from '../types/payment'
import type { ClientExport } from '../types/clientExport'
import type { Master } from '../types/staff'

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [data, setData] = useState<ClientExport | null>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [erasureConfirmOpen, setErasureConfirmOpen] = useState(false)
  const [erasing, setErasing] = useState(false)

  const load = useCallback(() => {
    if (!id) return Promise.resolve()
    return exportClientData(id).then(setData)
  }, [id])

  useEffect(() => {
    let cancelled = false
    // Легитимный случай: id из useParams() может смениться без ремаунта (Router переиспользует
    // компонент), так что сброс loading/error здесь синхронизирует UI с новым async-запросом,
    // а не дублирует initial state (см. также комментарий в SlotPicker.tsx).
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError(null)

    const requests: Promise<unknown>[] = [load()]
    if (isAdmin) {
      requests.push(listStaff().then(setMasters))
    }

    Promise.all(requests)
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить клиента'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [load, isAdmin])

  const mastersById = useMemo(() => new Map(masters.map((m) => [m.id, m])), [masters])

  const handleExport = () => {
    if (!data) return
    downloadJson(`client-${data.client.id}.json`, data)
  }

  const handleErase = async () => {
    if (!id) return
    setErasing(true)
    setActionError(null)
    try {
      await eraseClientData(id)
      navigate('/clients', { replace: true })
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Не удалось удалить данные клиента'))
      setErasureConfirmOpen(false)
    } finally {
      setErasing(false)
    }
  }

  if (loading) {
    return <p>Загрузка…</p>
  }

  if (loadError || !data) {
    return (
      <section>
        <p role="alert">{loadError ?? 'Клиент не найден'}</p>
        <Link to="/clients">← К списку клиентов</Link>
      </section>
    )
  }

  const { client, bookings } = data

  return (
    <section>
      <p>
        <Link to="/clients">← К списку клиентов</Link>
      </p>

      <h1>{client.name}</h1>

      {actionError && <p role="alert">{actionError}</p>}

      <dl className="client-card">
        <dt>Телефон</dt>
        <dd>{client.phone}</dd>
        <dt>Email</dt>
        <dd>{client.email ?? '—'}</dd>
        <dt>Заметки</dt>
        <dd>{client.notes ?? '—'}</dd>
        <dt>Теги</dt>
        <dd>{client.tags.length > 0 ? client.tags.join(', ') : '—'}</dd>
        <dt>Согласие на обработку данных</dt>
        <dd>
          {client.consentWithdrawnAt
            ? `Отозвано ${new Date(client.consentWithdrawnAt).toLocaleDateString('ru-RU')}`
            : client.consentGivenAt
              ? `Получено ${new Date(client.consentGivenAt).toLocaleDateString('ru-RU')}`
              : '—'}
        </dd>
      </dl>

      {isAdmin && (
        <div className="modal-actions client-actions">
          <button type="button" onClick={() => setEditModalOpen(true)}>
            Редактировать
          </button>
          <button type="button" onClick={handleExport}>
            Скачать JSON
          </button>
          <button type="button" className="button-danger" onClick={() => setErasureConfirmOpen(true)}>
            Удалить данные клиента
          </button>
        </div>
      )}

      <h2>История визитов</h2>
      {bookings.length === 0 ? (
        <p>Записей пока нет</p>
      ) : (
        <ul className="booking-list">
          {bookings.map((booking) => (
            <li key={booking.id} className="booking-item">
              <div className="booking-item-time">
                {toDateOnly(booking.startTime)} {formatTimeRange(booking.startTime, booking.endTime)}
              </div>
              <div className="booking-item-details">
                <strong>{booking.serviceName}</strong>
                <span>{isAdmin ? (mastersById.get(booking.masterId)?.name ?? '—') : 'Вы'}</span>
                <span>
                  {booking.payment
                    ? isFullPayment(booking.payment)
                      ? `Оплачено: ${booking.payment.amount} (${booking.payment.method})`
                      : `Оплачено ${booking.payment.paidAt ? new Date(booking.payment.paidAt).toLocaleDateString('ru-RU') : ''}`
                    : 'Не оплачено'}
                </span>
              </div>
              <div className="booking-item-status">{STATUS_LABELS[booking.status]}</div>
            </li>
          ))}
        </ul>
      )}

      {editModalOpen && (
        <EditClientModal
          client={client}
          onClose={() => setEditModalOpen(false)}
          onUpdated={() => void load()}
        />
      )}

      {erasureConfirmOpen && (
        <ConfirmDialog
          title="Удаление данных клиента"
          message="Персональные данные клиента (имя, телефон, email, заметки) будут анонимизированы. История записей и оплат сохранится для отчётности, но перестанет быть связана с личностью клиента. Действие необратимо."
          confirmLabel="Удалить"
          busy={erasing}
          onConfirm={() => void handleErase()}
          onCancel={() => setErasureConfirmOpen(false)}
        />
      )}
    </section>
  )
}
