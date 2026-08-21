import type { BookingSource, BookingStatus } from './booking'
import type { Client } from './client'
import type { PaymentView } from './payment'

export interface ExportedBooking {
  id: string
  masterId: string
  serviceId: string
  serviceName: string
  startTime: string
  endTime: string
  status: BookingStatus
  source: BookingSource
  payment: PaymentView | null
}

// Ответ GET /clients/:id/export — источник и для "истории визитов" в карточке,
// и для скачивания JSON (см. ClientsService.exportClientData на бэкенде).
export interface ClientExport {
  client: Client
  bookings: ExportedBooking[]
  exportedAt: string
}
