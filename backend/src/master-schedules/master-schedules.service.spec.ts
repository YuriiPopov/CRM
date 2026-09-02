import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MasterSchedulesService } from './master-schedules.service';

describe('MasterSchedulesService', () => {
  let service: MasterSchedulesService;
  let prisma: {
    master: { findFirst: jest.Mock };
    masterSchedule: { findMany: jest.Mock; upsert: jest.Mock };
    booking: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@b4u.local',
    role: Role.ADMIN,
    salonId: 'salon-1',
    masterId: null,
  };

  beforeEach(async () => {
    prisma = {
      master: { findFirst: jest.fn() },
      masterSchedule: { findMany: jest.fn(), upsert: jest.fn() },
      booking: { findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterSchedulesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MasterSchedulesService);
  });

  describe('findMonth', () => {
    it('reads the schedule scoped to salon, master and the month range', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.masterSchedule.findMany.mockResolvedValue([]);

      await service.findMonth(
        { masterId: 'master-1', year: 2026, month: 3 },
        admin,
      );

      expect(prisma.masterSchedule.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          masterId: 'master-1',
          date: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lt: new Date('2026-04-01T00:00:00.000Z'),
          },
        },
        orderBy: { date: 'asc' },
      });
    });

    it('throws NotFoundException when the master does not belong to the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.findMonth({ masterId: 'missing', year: 2026, month: 3 }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('upsertMonth', () => {
    it('upserts each day of the month and clears hours for non-working days', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.masterSchedule.upsert.mockResolvedValue({});
      prisma.masterSchedule.findMany.mockResolvedValue([]);

      await service.upsertMonth(
        {
          masterId: 'master-1',
          year: 2026,
          month: 3,
          days: [
            {
              date: '2026-03-02',
              isWorking: true,
              startTime: '09:00',
              endTime: '18:00',
            },
            {
              date: '2026-03-03',
              isWorking: false,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
        admin,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.masterSchedule.upsert).toHaveBeenCalledWith({
        where: {
          masterId_date: {
            masterId: 'master-1',
            date: new Date('2026-03-02T00:00:00.000Z'),
          },
        },
        create: {
          salonId: 'salon-1',
          masterId: 'master-1',
          date: new Date('2026-03-02T00:00:00.000Z'),
          isWorking: true,
          startTime: '09:00',
          endTime: '18:00',
        },
        update: { isWorking: true, startTime: '09:00', endTime: '18:00' },
      });
      // Часы игнорируются и обнуляются для нерабочего дня, даже если пришли в запросе.
      expect(prisma.masterSchedule.upsert).toHaveBeenCalledWith({
        where: {
          masterId_date: {
            masterId: 'master-1',
            date: new Date('2026-03-03T00:00:00.000Z'),
          },
        },
        create: {
          salonId: 'salon-1',
          masterId: 'master-1',
          date: new Date('2026-03-03T00:00:00.000Z'),
          isWorking: false,
          startTime: null,
          endTime: null,
        },
        update: { isWorking: false, startTime: null, endTime: null },
      });
    });

    it('rejects a day that does not belong to the specified year/month', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });

      await expect(
        service.upsertMonth(
          {
            masterId: 'master-1',
            year: 2026,
            month: 3,
            days: [{ date: '2026-04-01', isWorking: true }],
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the master does not belong to the salon', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertMonth(
          {
            masterId: 'missing',
            year: 2026,
            month: 3,
            days: [{ date: '2026-03-02', isWorking: true }],
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findConflicts', () => {
    it('reports bookings that fall on a day becoming non-working', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      const conflictingBooking = {
        id: 'booking-1',
        startTime: new Date('2026-03-03T10:00:00.000Z'),
      };
      prisma.booking.findMany.mockResolvedValue([conflictingBooking]);

      const result = await service.findConflicts(
        {
          masterId: 'master-1',
          year: 2026,
          month: 3,
          days: [{ date: '2026-03-03', isWorking: false }],
        },
        admin,
      );

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          masterId: 'master-1',
          status: { notIn: [BookingStatus.CANCELLED] },
          OR: [
            {
              startTime: {
                gte: new Date('2026-03-03T00:00:00.000Z'),
                lt: new Date('2026-03-04T00:00:00.000Z'),
              },
            },
          ],
        },
        orderBy: { startTime: 'asc' },
      });
      expect(result).toEqual([conflictingBooking]);
    });

    it('reports no conflicts when no day in the proposed schedule becomes non-working', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });

      const result = await service.findConflicts(
        {
          masterId: 'master-1',
          year: 2026,
          month: 3,
          days: [{ date: '2026-03-03', isWorking: true }],
        },
        admin,
      );

      expect(result).toEqual([]);
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('rejects a day that does not belong to the specified year/month', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });

      await expect(
        service.findConflicts(
          {
            masterId: 'master-1',
            year: 2026,
            month: 3,
            days: [{ date: '2026-04-01', isWorking: false }],
          },
          admin,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
