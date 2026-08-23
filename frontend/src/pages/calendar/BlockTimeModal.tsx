import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../auth/useAuth'
import { createMasterBlock } from '../../api/masterBlocks'
import { getApiErrorMessage } from '../../api/errors'
import type { Master } from '../../types/staff'

interface BlockTimeModalProps {
  masters: Master[]
  defaultDate: string
  onClose: () => void
  onCreated: () => void
}

// Резервирование времени мастера (Backlog п.9) — ADMIN блокирует любого мастера салона,
// MASTER — только себя (см. CreateBookingModal, тот же приём с masterId). Время — в UTC,
// как и везде в календаре (см. dateUtils.ts): часы вводятся как есть, без локальной таймзоны браузера.
export function BlockTimeModal({ masters, defaultDate, onClose, onCreated }: BlockTimeModalProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [masterId, setMasterId] = useState(isAdmin ? '' : (user?.masterId ?? ''))
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(masterId && date && startTime && endTime) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await createMasterBlock({
        masterId: isAdmin ? masterId : undefined,
        startTime: `${date}T${startTime}:00.000Z`,
        endTime: `${date}T${endTime}:00.000Z`,
        reason: reason.trim() ? reason.trim() : undefined,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось заблокировать время'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Заблокировать время" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        {isAdmin ? (
          <label htmlFor="block-master">
            Мастер
            <select
              id="block-master"
              value={masterId}
              onChange={(event) => setMasterId(event.target.value)}
              required
            >
              <option value="" disabled>
                Выберите мастера
              </option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>Мастер: вы</p>
        )}

        <label htmlFor="block-date">
          Дата
          <input
            id="block-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>

        <label htmlFor="block-start">
          С (UTC)
          <input
            id="block-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>

        <label htmlFor="block-end">
          До (UTC)
          <input
            id="block-end"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            required
          />
        </label>

        <label htmlFor="block-reason">
          Причина (необязательно)
          <input
            id="block-reason"
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={255}
            placeholder="Отпуск, отгул, перерыв…"
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Блокируем…' : 'Заблокировать'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
