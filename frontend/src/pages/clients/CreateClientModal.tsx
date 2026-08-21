import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { createClient } from '../../api/clients'
import { getApiErrorMessage } from '../../api/errors'
import { parseTags } from './tags'
import type { Client } from '../../types/client'

interface CreateClientModalProps {
  onClose: () => void
  onCreated: (client: Client) => void
}

export function CreateClientModal({ onClose, onCreated }: CreateClientModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim() && phone.trim() && consentGiven) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const client = await createClient({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: parseTags(tagsInput),
        consentGiven,
      })
      onCreated(client)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось создать клиента'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новый клиент" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="client-name">
          Имя
          <input id="client-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label htmlFor="client-phone">
          Телефон
          <input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>

        <label htmlFor="client-email">
          Email
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label htmlFor="client-notes">
          Заметки
          <textarea id="client-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label htmlFor="client-tags">
          Теги (через запятую)
          <input id="client-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
          />
          Клиент дал согласие на обработку персональных данных
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Создаём…' : 'Создать клиента'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
