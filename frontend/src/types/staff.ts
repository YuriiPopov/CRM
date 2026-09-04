import type { Service } from './service'

export interface Master {
  id: string
  salonId: string
  name: string
  specializationCategoryIds: string[]
  isActive: boolean
  // Base64 data URL или null, если фото не загружено (item41). Отдаётся инлайн и в списке,
  // и в карточке мастера — см. StaffService.toMasterDetail на бэкенде.
  photo: string | null
  createdAt: string
}

// GET /staff/:id — тот же Master + плоский массив привязанных услуг (через MasterService,
// см. StaffService.findOne на бэкенде)
export interface MasterDetail extends Master {
  services: Service[]
}

// Плоская пара мастер↔услуга — клиентское представление связки MasterService, собранное
// из нескольких MasterDetail (см. listMasterServiceLinks в api/staff.ts): отдельного
// bulk-эндпоинта, отдающего все связки салона разом, на бэкенде нет.
export interface MasterServiceLink {
  masterId: string
  serviceId: string
}
