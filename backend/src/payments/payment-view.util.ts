import { Payment, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// MASTER видит только факт оплаты — без суммы/скидки/метода (см. ТЗ, раздел 2 "Роли пользователей").
// Используется и в PaymentsService, и в экспорте данных клиента (GDPR) — единое правило видимости.
export type MasterPaymentView = Pick<Payment, 'id' | 'bookingId' | 'paidAt'>;

export function toPaymentView(
  payment: Payment,
  user: Pick<AuthenticatedUser, 'role'>,
): Payment | MasterPaymentView {
  if (user.role === Role.ADMIN) {
    return payment;
  }

  return {
    id: payment.id,
    bookingId: payment.bookingId,
    paidAt: payment.paidAt,
  };
}
