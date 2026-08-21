import { apiClient } from './client'
import type { RevenueReport } from '../types/payment'

export interface RevenueReportQuery {
  from?: string
  to?: string
}

// ADMIN-only на бэкенде (@Roles(ADMIN) на GET /payments/report/revenue)
export async function getRevenueReport(query: RevenueReportQuery = {}): Promise<RevenueReport> {
  const response = await apiClient.get<RevenueReport>('/payments/report/revenue', { params: query })
  return response.data
}
