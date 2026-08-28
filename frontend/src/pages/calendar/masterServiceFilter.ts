import type { Master, MasterServiceLink } from '../../types/staff'
import type { Service } from '../../types/service'

// Пустой masterId ("ничего не выбрано") — сужения нет, отдаём список услуг как есть.
export function filterServicesForMaster(
  services: Service[],
  links: MasterServiceLink[],
  masterId: string,
): Service[] {
  if (!masterId) return services

  const allowedServiceIds = new Set(
    links.filter((link) => link.masterId === masterId).map((link) => link.serviceId),
  )
  return services.filter((service) => allowedServiceIds.has(service.id))
}

// Деактивированный мастер не должен предлагаться для новой записи независимо от того,
// выбрана ли услуга — сужаем по isActive всегда, а по serviceId только когда он задан.
export function filterMastersForService(
  masters: Master[],
  links: MasterServiceLink[],
  serviceId: string,
): Master[] {
  const activeMasters = masters.filter((master) => master.isActive)
  if (!serviceId) return activeMasters

  const allowedMasterIds = new Set(
    links.filter((link) => link.serviceId === serviceId).map((link) => link.masterId),
  )
  return activeMasters.filter((master) => allowedMasterIds.has(master.id))
}

// Используется формой создания записи, чтобы решить, нужно ли сбросить ранее выбранного
// мастера/услугу при смене другого поля на несовместимое значение.
export function isMasterServiceLinked(
  links: MasterServiceLink[],
  masterId: string,
  serviceId: string,
): boolean {
  return links.some((link) => link.masterId === masterId && link.serviceId === serviceId)
}
