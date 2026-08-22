import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    booking: { findFirst: jest.Mock };
    payment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@b4u.local',
    role: Role.ADMIN,
    salonId: 'salon-1',
    masterId: null,
  };

  const master: AuthenticatedUser = {
    id: 'master-user-1',
    email: 'master@b4u.local',
    role: Role.MASTER,
    salonId: 'salon-1',
    masterId: 'master-rec-1',
  };

  beforeEach(async () => {
    prisma = {
      booking: { findFirst: jest.fn() },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('create', () => {
    const dto = { bookingId: 'booking-1', amount: 100, method: 'cash' };

    it('throws NotFoundException when the booking is not in the salon', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.create(dto, 'salon-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects payment for a booking that is not completed', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
      });

      await expect(service.create(dto, 'salon-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects a discount larger than the amount', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.create({ ...dto, discount: 150 }, 'salon-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('creates a payment stamped as paid for a completed booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
      });
      prisma.payment.create.mockResolvedValue({ id: 'payment-1' });

      await service.create({ ...dto, discount: 20 }, 'salon-1');

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-1',
          amount: 100,
          discount: 20,
          method: 'cash',
          status: 'paid',
          paidAt: expect.any(Date) as Date,
        },
      });
    });

    it('defaults discount to 0 when not provided', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
      });
      prisma.payment.create.mockResolvedValue({ id: 'payment-1' });

      await service.create(dto, 'salon-1');

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
          data: expect.objectContaining({ discount: 0 }),
        }),
      );
    });

    it('rejects a duplicate payment for the same booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
      });
      prisma.payment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(service.create(dto, 'salon-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findAll / findOne view scoping', () => {
    const fullPayment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      amount: new Prisma.Decimal(100),
      discount: new Prisma.Decimal(10),
      method: 'cash',
      status: 'paid',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    it('returns full payment details to ADMIN', async () => {
      prisma.payment.findMany.mockResolvedValue([fullPayment]);

      const result = await service.findAll(admin);

      expect(result).toEqual([fullPayment]);
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { booking: { salonId: 'salon-1' } },
        orderBy: { paidAt: 'desc' },
      });
    });

    it('returns only the fact of payment to MASTER, scoped to their own bookings', async () => {
      prisma.payment.findMany.mockResolvedValue([fullPayment]);

      const result = await service.findAll(master);

      expect(result).toEqual([
        { id: 'payment-1', bookingId: 'booking-1', paidAt: fullPayment.paidAt },
      ]);
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { booking: { salonId: 'salon-1', masterId: 'master-rec-1' } },
        orderBy: { paidAt: 'desc' },
      });
    });

    it('findOne throws NotFoundException when out of scope', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('payment-1', master)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getRevenueReport', () => {
    it('rejects an inverted date range', async () => {
      await expect(
        service.getRevenueReport(
          { from: '2026-02-01', to: '2026-01-01' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.aggregate).not.toHaveBeenCalled();
    });

    it('computes net revenue as gross minus discount', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: {
          amount: new Prisma.Decimal(500),
          discount: new Prisma.Decimal(50),
        },
        _count: 5,
      });

      const result = await service.getRevenueReport({}, 'salon-1');

      expect(result).toEqual({
        from: null,
        to: null,
        paymentsCount: 5,
        grossAmount: 500,
        totalDiscount: 50,
        netRevenue: 450,
      });
      expect(prisma.payment.aggregate).toHaveBeenCalledWith({
        where: { booking: { salonId: 'salon-1' } },
        _sum: { amount: true, discount: true },
        _count: true,
      });
    });

    it('applies the from/to date filter and handles an empty result', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null, discount: null },
        _count: 0,
      });

      const result = await service.getRevenueReport(
        { from: '2026-01-01', to: '2026-01-31' },
        'salon-1',
      );

      expect(result).toEqual({
        from: '2026-01-01',
        to: '2026-01-31',
        paymentsCount: 0,
        grossAmount: 0,
        totalDiscount: 0,
        netRevenue: 0,
      });
      expect(prisma.payment.aggregate).toHaveBeenCalledWith({
        where: {
          booking: { salonId: 'salon-1' },
          paidAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          },
        },
        _sum: { amount: true, discount: true },
        _count: true,
      });
    });

    it('extends a bare "to" date to the end of that day, not midnight', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100), discount: new Prisma.Decimal(0) },
        _count: 1,
      });

      await service.getRevenueReport({ to: '2026-08-22' }, 'salon-1');

      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: { lte: new Date('2026-08-22T23:59:59.999Z') },
          }),
        }),
      );
    });

    it('leaves a "to" timestamp that already has a time component untouched', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100), discount: new Prisma.Decimal(0) },
        _count: 1,
      });

      await service.getRevenueReport({ to: '2026-08-22T10:00:00.000Z' }, 'salon-1');

      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: { lte: new Date('2026-08-22T10:00:00.000Z') },
          }),
        }),
      );
    });
  });
});
