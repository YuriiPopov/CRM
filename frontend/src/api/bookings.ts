import { apiClient } from './client'
import type { Booking, BookingStatus } from '../types/booking'

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

export async function listBookings(): Promise<Booking[]> {
  const response = await apiClient.get<Booking[]>('/bookings')
  return response.data
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
