export interface ServiceCategoryRef {
  id: string
  salonId: string
  name: string
  isDefault: boolean
  createdAt: string
}

export interface Service {
  id: string
  salonId: string
  name: string
  categoryId: string
  durationMin: number
  price: number
  createdAt: string
}
