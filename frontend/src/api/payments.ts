import { apiClient } from './client'
import type { Payment, PaymentView, RevenueReport } from '../types/payment'

export interface RevenueReportQuery {
  from?: string
  to?: string
}

export interface CreatePaymentInput {
  bookingId: string
  amount: number
  discount?: number
  method: string
}

// ADMIN-only на бэкенде (@Roles(ADMIN) на GET /payments/report/revenue)
export async function getRevenueReport(query: RevenueReportQuery = {}): Promise<RevenueReport> {
  const response = await apiClient.get<RevenueReport>('/payments/report/revenue', { params: query })
  return response.data
}

// ADMIN видит полные детали, MASTER — только факт оплаты своих записей (см. PaymentsService.findAll)
export async function listPayments(): Promise<PaymentView[]> {
  const response = await apiClient.get<PaymentView[]>('/payments')
  return response.data
}

// ADMIN-only на бэкенде (@Roles(ADMIN) на POST /payments); 409, если у записи уже есть оплата
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const response = await apiClient.post<Payment>('/payments', input)
  return response.data
}
