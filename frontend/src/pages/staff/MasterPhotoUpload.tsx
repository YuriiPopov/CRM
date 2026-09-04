import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { removeMasterPhoto, uploadMasterPhoto } from '../../api/staff'
import { getApiErrorMessage } from '../../api/errors'
import { ALLOWED_MASTER_PHOTO_TYPES, isAllowedMasterPhotoType, resizeImageFile } from './masterPhoto'
import type { MasterDetail } from '../../types/staff'

interface MasterPhotoUploadProps {
  master: MasterDetail
  // Как и EditMasterModal.onUpdated в этом файле, не читаем возвращённого мастера напрямую —
  // просто просим родителя перезагрузить карточку через load(), чтобы не дублировать источник истины.
  onChanged: () => void
}

// Блок загрузки/замены/удаления фото на StaffDetailPage (item41) — доступен только ADMIN
// (видимость форсируется вызывающей стороной), сами эндпоинты тоже ADMIN-only на бэкенде.
export function MasterPhotoUpload({ master, onChanged }: MasterPhotoUploadProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!isAllowedMasterPhotoType(file.type)) {
      setError('Поддерживаются форматы JPEG, PNG, WebP')
      return
    }

    setError(null)
    setBusy(true)
    try {
      const photo = await resizeImageFile(file)
      await uploadMasterPhoto(master.id, photo)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить фото'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setError(null)
    setBusy(true)
    try {
      await removeMasterPhoto(master.id)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось удалить фото'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="master-photo">
      {master.photo ? (
        <img src={master.photo} alt={master.name} className="master-photo-preview" />
      ) : (
        <div className="master-photo-placeholder">Нет фото</div>
      )}

      <div className="master-photo-actions">
        <label htmlFor="master-photo-input">
          {busy ? 'Загружаем…' : master.photo ? 'Заменить фото' : 'Загрузить фото'}
          <input
            id="master-photo-input"
            type="file"
            accept={ALLOWED_MASTER_PHOTO_TYPES.join(',')}
            onChange={(event) => void handleFileChange(event)}
            disabled={busy}
          />
        </label>

        {master.photo && (
          <button
            type="button"
            className="button-danger"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            Удалить фото
          </button>
        )}

        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  )
}
