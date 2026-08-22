import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createPayment } from '../../api/payments'
import { getApiErrorMessage } from '../../api/errors'
import type { Booking } from '../../types/booking'
import type { Service } from '../../types/service'

interface CreatePaymentModalProps {
  booking: Booking
  service: Service | undefined
  onClose: () => void
  onCreated: () => void
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
}

// Только для COMPLETED-записи без оплаты (см. кнопку "Создать оплату" в BookingListItem) —
// backend всё равно перепроверит и то, и другое (409/404), это лишь предзаполнение формы.
export function CreatePaymentModal({ booking, service, onClose, onCreated }: CreatePaymentModalProps) {
  const [amount, setAmount] = useState(service ? String(service.price) : '')
  const [discount, setDiscount] = useState('0')
  const [method, setMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(amount) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await createPayment({
        bookingId: booking.id,
        amount: Number(amount),
        discount: Number(discount || 0),
        method,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать оплату'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Оплата записи" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <p>Услуга: {service?.name ?? '—'}</p>

        <label htmlFor="payment-amount">
          Сумма
          <input
            id="payment-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <label htmlFor="payment-discount">
          Скидка
          <input
            id="payment-discount"
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </label>

        <label htmlFor="payment-method">
          Способ оплаты
          <select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value)}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Создаём…' : 'Создать оплату'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
