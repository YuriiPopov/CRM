export type ServiceCategory = 'MANICURE_PEDICURE' | 'SPA' | 'MASSAGE'

export interface Service {
  id: string
  salonId: string
  name: string
  category: ServiceCategory
  durationMin: number
  price: number
  createdAt: string
}
