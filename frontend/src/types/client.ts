export interface Client {
  id: string
  salonId: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  tags: string[]
  consentGivenAt: string | null
  consentWithdrawnAt: string | null
  createdAt: string
}
