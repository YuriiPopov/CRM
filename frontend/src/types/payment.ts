// Полный вид оплаты — то, что видит ADMIN (см. PaymentsService.toView на бэкенде)
export interface Payment {
  id: string
  bookingId: string
  amount: number
  discount: number
  method: string
  status: string
  paidAt: string | null
}

// MASTER видит только факт оплаты — см. src/payments/payment-view.util.ts на бэкенде
export interface MasterPaymentView {
  id: string
  bookingId: string
  paidAt: string | null
}

export type PaymentView = Payment | MasterPaymentView

export function isFullPayment(payment: PaymentView): payment is Payment {
  return 'amount' in payment
}

// Ответ GET /payments/report/revenue (см. PaymentsService.getRevenueReport на бэкенде)
export interface RevenueReport {
  from: string | null
  to: string | null
  paymentsCount: number
  grossAmount: number
  totalDiscount: number
  netRevenue: number
}
