import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Payment, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';

// MASTER видит только факт оплаты по своей записи — без суммы/скидки/метода (см. ТЗ, раздел 2 "Роли пользователей")
export type MasterPaymentView = Pick<Payment, 'id' | 'bookingId' | 'paidAt'>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Оплата создаётся только для завершённой записи — деньги фиксируются по факту оказания услуги
  // (депозиты/предоплата намеренно вне MVP, см. ТЗ, раздел 8 "MVP и roadmap")
  async create(dto: CreatePaymentDto, salonId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, salonId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException(
        'Payment can only be recorded for a completed booking',
      );
    }

    const discount = dto.discount ?? 0;
    if (discount > dto.amount) {
      throw new BadRequestException(
        'Discount cannot exceed the payment amount',
      );
    }

    try {
      return await this.prisma.payment.create({
        data: {
          bookingId: dto.bookingId,
          amount: dto.amount,
          discount,
          method: dto.method,
          status: 'paid',
          paidAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This booking already has a payment');
      }
      throw error;
    }
  }

  async findAll(user: AuthenticatedUser) {
    const payments = await this.prisma.payment.findMany({
      where: this.scopeWhere(user),
      orderBy: { paidAt: 'desc' },
    });

    return payments.map((payment) => this.toView(payment, user));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user)] },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toView(payment, user);
  }

  // Отчёт по выручке за период — минимальная версия отчётности из ТЗ (только ADMIN, см. RolesGuard)
  async getRevenueReport(query: RevenueReportQueryDto, salonId: string) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new BadRequestException('"from" must not be after "to"');
    }

    const where: Prisma.PaymentWhereInput = { booking: { salonId } };
    if (query.from || query.to) {
      where.paidAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }

    const aggregate = await this.prisma.payment.aggregate({
      where,
      _sum: { amount: true, discount: true },
      _count: true,
    });

    const grossAmount = Number(aggregate._sum.amount ?? 0);
    const totalDiscount = Number(aggregate._sum.discount ?? 0);

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      paymentsCount: aggregate._count,
      grossAmount,
      totalDiscount,
      netRevenue: grossAmount - totalDiscount,
    };
  }

  private toView(
    payment: Payment,
    user: AuthenticatedUser,
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

  // ADMIN видит все оплаты салона; MASTER — только по своим записям (Payment не несёт salonId напрямую — скоуп через booking)
  private scopeWhere(user: AuthenticatedUser): Prisma.PaymentWhereInput {
    if (user.role === Role.ADMIN) {
      return { booking: { salonId: user.salonId } };
    }

    if (!user.masterId) {
      return { id: '__none__' };
    }

    return { booking: { salonId: user.salonId, masterId: user.masterId } };
  }
}
