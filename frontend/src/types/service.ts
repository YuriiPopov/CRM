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

// Используется и на экране Услуг, и в специализации мастера (Master.specialization — та же enum)
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MANICURE_PEDICURE: 'Маникюр/педикюр',
  SPA: 'СПА',
  MASSAGE: 'Массаж',
}
