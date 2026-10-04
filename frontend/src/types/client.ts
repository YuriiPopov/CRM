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
  // Считаются на backend и приходят только из GET /clients и GET /clients/:id (item74);
  // ответы create/update их не содержат — новый/отредактированный клиент без флага.
  noShowCount?: number
  unreliable?: boolean
}
