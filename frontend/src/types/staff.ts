import type { ServiceCategory } from './service'

export interface Master {
  id: string
  salonId: string
  name: string
  specialization: ServiceCategory
  isActive: boolean
  createdAt: string
}
