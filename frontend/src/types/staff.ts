import type { Service, ServiceCategory } from './service'

export interface Master {
  id: string
  salonId: string
  name: string
  specialization: ServiceCategory
  isActive: boolean
  createdAt: string
}

// GET /staff/:id — тот же Master + плоский массив привязанных услуг (через MasterService,
// см. StaffService.findOne на бэкенде)
export interface MasterDetail extends Master {
  services: Service[]
}
