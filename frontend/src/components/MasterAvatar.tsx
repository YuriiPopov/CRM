import { getMasterColor } from '../pages/dashboard/masterColor'
import type { Master } from '../types/staff'

interface MasterAvatarProps {
  master: Pick<Master, 'id' | 'name' | 'photo'>
  className?: string
  // Переопределяет цвет заглушки вместо getMasterColor(master.id) — нужно для пользователей
  // без реального masterId (ADMIN в шапке приложения, item43), где цвет по хэшу id не подходит.
  color?: string
}

// До двух инициалов для заглушки без фото — тот же случай "нет фото", что и в
// MasterPhotoUpload (item41), но компактно, внутри цветного круга.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

// Круглый аватар мастера — фото (item41) или заглушка с инициалами на цвете мастера
// (getMasterColor — та же индикация, что и бордюр в BookingGridCard), переиспользуется в
// MasterColumnsView (заголовок колонки) и BookingGridCard (карточка записи в сетке), item42.
// alt пустой: имя мастера всегда выводится рядом текстом, аватар здесь чисто декоративный.
export function MasterAvatar({ master, className, color }: MasterAvatarProps) {
  const classNames = ['master-avatar', className].filter(Boolean).join(' ')

  if (master.photo) {
    return <img src={master.photo} alt="" className={classNames} />
  }

  return (
    <span className={classNames} style={{ backgroundColor: color ?? getMasterColor(master.id) }} aria-hidden="true">
      {getInitials(master.name)}
    </span>
  )
}
