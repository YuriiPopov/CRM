import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { updateClient } from '../../api/clients'
import { getApiErrorMessage } from '../../api/errors'
import { parseTags } from './tags'
import type { Client } from '../../types/client'

interface EditClientModalProps {
  client: Client
  onClose: () => void
  onUpdated: (client: Client) => void
}

export function EditClientModal({ client, onClose, onUpdated }: EditClientModalProps) {
  const [name, setName] = useState(client.name)
  const [phone, setPhone] = useState(client.phone)
  const [email, setEmail] = useState(client.email ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [tagsInput, setTagsInput] = useState(client.tags.join(', '))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(name.trim() && phone.trim()) && !submitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const updated = await updateClient(client.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: parseTags(tagsInput),
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось сохранить изменения'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Редактирование клиента" onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="edit-client-name">
          Имя
          <input id="edit-client-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label htmlFor="edit-client-phone">
          Телефон
          <input
            id="edit-client-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>

        <label htmlFor="edit-client-email">
          Email
          <input
            id="edit-client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label htmlFor="edit-client-notes">
          Заметки
          <textarea id="edit-client-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label htmlFor="edit-client-tags">
          Теги (через запятую)
          <input
            id="edit-client-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
