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

// Фото услуги (item84): image — base64 data URL, position 0 = обложка
export interface ServicePhoto {
  id: string
  position: number
  image: string
}
