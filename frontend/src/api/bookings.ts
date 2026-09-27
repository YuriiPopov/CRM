import { apiClient } from './client'
import type { Booking, BookingSource, BookingStatus } from '../types/booking'

export interface CreateBookingInput {
  clientId: string
  masterId: string
  serviceId: string
  startTime: string
}

export interface RescheduleBookingInput {
  startTime: string
  masterId: string
}

// Необязательные серверные фильтры GET /bookings (item61) — без них, как и раньше, весь скоуп роли
export interface ListBookingsFilters {
  source?: BookingSource
  status?: BookingStatus
  from?: string
}

export async function listBookings(filters?: ListBookingsFilters): Promise<Booking[]> {
  const response = await apiClient.get<Booking[]>('/bookings', filters ? { params: filters } : undefined)
  return response.data
}

// Число будущих онлайн-записей, ждущих подтверждения (только ADMIN) — счётчик в навигации
export async function getPendingOnlineCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/bookings/pending-online/count')
  return response.data.count
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const response = await apiClient.post<Booking>('/bookings', input)
  return response.data
}

export async function rescheduleBooking(
  id: string,
  input: RescheduleBookingInput,
): Promise<Booking> {
  const response = await apiClient.patch<Booking>(`/bookings/${id}/reschedule`, input)
  return response.data
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  const response = await apiClient.patch<Booking>(`/bookings/${id}/status`, { status })
  return response.data
}
