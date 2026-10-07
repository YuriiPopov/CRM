import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  addServicePhoto,
  deleteServicePhoto,
  listServicePhotos,
  reorderServicePhotos,
} from '../../api/services'
import { getApiErrorMessage } from '../../api/errors'
import type { ServicePhoto } from '../../types/service'
import {
  MAX_SERVICE_PHOTOS,
  SERVICE_PHOTO_MAX_BYTES,
  compressServicePhoto,
  dataUrlByteLength,
  isAllowedServicePhotoType,
  moveItem,
} from './servicePhotos'

interface ServicePhotosBlockProps {
  serviceId: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp'

// Блок «Фото» в форме редактирования услуги (item84): до 5 миниатюр, первая — обложка.
// Каждое действие сразу уходит на сервер (как MasterPhotoUpload), а не ждёт «Сохранить» формы;
// ошибки сервера показываются здесь же.
export function ServicePhotosBlock({ serviceId }: ServicePhotosBlockProps) {
  const [photos, setPhotos] = useState<ServicePhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoToDelete, setPhotoToDelete] = useState<ServicePhoto | null>(null)
  const dragIndex = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listServicePhotos(serviceId)
      .then((loaded) => {
        if (!cancelled) setPhotos(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Не удалось загрузить фото'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [serviceId])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!isAllowedServicePhotoType(file.type)) {
      setError('Поддерживаются форматы JPEG, PNG, WebP')
      return
    }

    setError(null)
    setBusy(true)
    try {
      const image = await compressServicePhoto(file)
      if (dataUrlByteLength(image) > SERVICE_PHOTO_MAX_BYTES) {
        setError('Фото больше 1 МБ даже после сжатия — выберите другое')
        return
      }
      const added = await addServicePhoto(serviceId, image)
      setPhotos((current) => [...current, added])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Не удалось загрузить фото'))
    } finally {
      setBusy(false)
    }
  }

  const applyOrder = useCallback(
    async (from: number, to: number) => {
      const reordered = moveItem(photos, from, to)
      if (reordered.every((photo, index) => photo.id === photos[index].id)) return

      const previous = photos
      setPhotos(reordered)
      setError(null)
      setBusy(true)
      try {
        const saved = await reorderServicePhotos(
          serviceId,
          reordered.map((photo) => photo.id),
        )
        setPhotos(saved)
      } catch (err) {
        setPhotos(previous)
        setError(getApiErrorMessage(err, 'Не удалось изменить порядок фото'))
      } finally {
        setBusy(false)
      }
    },
    [photos, serviceId],
  )

  const handleConfirmDelete = async () => {
    if (!photoToDelete) return
    setError(null)
    setBusy(true)
    try {
      await deleteServicePhoto(serviceId, photoToDelete.id)
      setPhotos((current) => current.filter((photo) => photo.id !== photoToDelete.id))
      setPhotoToDelete(null)
    } catch (err) {
      setPhotoToDelete(null)
      setError(getApiErrorMessage(err, 'Не удалось удалить фото'))
    } finally {
      setBusy(false)
    }
  }

  const limitReached = photos.length >= MAX_SERVICE_PHOTOS

  return (
    <fieldset className="service-photos" aria-busy={busy || loading}>
      <legend>
        Фото ({photos.length}/{MAX_SERVICE_PHOTOS})
      </legend>

      <ul className="service-photos-list">
        {photos.map((photo, index) => (
          <li
            key={photo.id}
            className="service-photo"
            draggable={!busy}
            onDragStart={() => {
              dragIndex.current = index
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const from = dragIndex.current
              dragIndex.current = null
              if (from !== null) void applyOrder(from, index)
            }}
          >
            <img src={photo.image} alt={`Фото ${index + 1}`} className="service-photo-thumb" />
            {index === 0 && <span className="service-photo-cover">Обложка</span>}
            <div className="service-photo-actions">
              <button
                type="button"
                aria-label={`Сдвинуть фото ${index + 1} влево`}
                disabled={busy || index === 0}
                onClick={() => void applyOrder(index, index - 1)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label={`Сдвинуть фото ${index + 1} вправо`}
                disabled={busy || index === photos.length - 1}
                onClick={() => void applyOrder(index, index + 1)}
              >
                →
              </button>
              <button
                type="button"
                className="button-danger"
                aria-label={`Удалить фото ${index + 1}`}
                disabled={busy}
                onClick={() => setPhotoToDelete(photo)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}

        {!limitReached && (
          <li className="service-photo service-photo-add">
            <label htmlFor="service-photo-input">
              {busy ? 'Загружаем…' : '+ Добавить'}
              <input
                id="service-photo-input"
                type="file"
                accept={ACCEPT}
                onChange={(event) => void handleFileChange(event)}
                disabled={busy || loading}
              />
            </label>
          </li>
        )}
      </ul>

      {limitReached && <p className="service-photos-hint">Максимум {MAX_SERVICE_PHOTOS} фото</p>}
      {error && <p role="alert">{error}</p>}

      {photoToDelete && (
        <ConfirmDialog
          title="Удалить фото"
          message="Удалить это фото услуги?"
          confirmLabel="Удалить"
          busy={busy}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setPhotoToDelete(null)}
        />
      )}
    </fieldset>
  )
}
