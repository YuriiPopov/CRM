import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

  const master: AuthenticatedUser = {
    id: 'user-master-1',
    email: 'master@b4u.local',
    role: Role.MASTER,
    salonId: 'salon-1',
    masterId: 'master-1',
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

    it('allows a MASTER to read their own schedule', async () => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      prisma.masterSchedule.findMany.mockResolvedValue([]);

      await service.findMonth(
        { masterId: 'master-1', year: 2026, month: 3 },
        master,
      );

      expect(prisma.masterSchedule.findMany).toHaveBeenCalled();
    });

    it('forbids a MASTER from reading another master schedule', async () => {
      await expect(
        service.findMonth(
          { masterId: 'master-2', year: 2026, month: 3 },
          master,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.master.findFirst).not.toHaveBeenCalled();
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
    describe('with a fixed "now"', () => {
      // 2026-03-01 12:00 UTC в Варшаве (зима, UTC+1) — настенное время салона 13:00
      beforeEach(() => {
        jest
          .useFakeTimers()
          .setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
        prisma.master.findFirst.mockResolvedValue({ id: 'master-1' });
      });
      afterEach(() => jest.useRealTimers());

      const booking = (id: string, start: string, end: string) => ({
        id,
        startTime: new Date(`2026-03-03T${start}:00.000Z`),
        endTime: new Date(`2026-03-03T${end}:00.000Z`),
      });
      const narrowed = {
        masterId: 'master-1',
        year: 2026,
        month: 3,
        days: [
          {
            date: '2026-03-03',
            isWorking: true,
            startTime: '09:00',
            endTime: '14:00',
          },
        ],
      };

      it('queries only active bookings starting from salon now on the proposed days', async () => {
        prisma.booking.findMany.mockResolvedValue([]);

        await service.findConflicts(
          {
            ...narrowed,
            days: [...narrowed.days, { date: '2026-03-04', isWorking: false }],
          },
          admin,
        );

        expect(prisma.booking.findMany).toHaveBeenCalledWith({
          where: {
            salonId: 'salon-1',
            masterId: 'master-1',
            status: { in: [BookingStatus.CREATED, BookingStatus.CONFIRMED] },
            startTime: { gte: new Date('2026-03-01T13:00:00.000Z') },
            OR: [
              {
                startTime: {
                  gte: new Date('2026-03-03T00:00:00.000Z'),
                  lt: new Date('2026-03-04T00:00:00.000Z'),
                },
              },
              {
                startTime: {
                  gte: new Date('2026-03-04T00:00:00.000Z'),
                  lt: new Date('2026-03-05T00:00:00.000Z'),
                },
              },
            ],
          },
          orderBy: { startTime: 'asc' },
        });
      });

      it('flags bookings on a day becoming non-working as DAY_OFF', async () => {
        const b = booking('b1', '10:00', '11:00');
        prisma.booking.findMany.mockResolvedValue([b]);

        const result = await service.findConflicts(
          { ...narrowed, days: [{ date: '2026-03-03', isWorking: false }] },
          admin,
        );

        expect(result).toEqual([{ ...b, reason: 'DAY_OFF' }]);
      });

      it('flags bookings partly or fully outside the new hours as OUTSIDE_HOURS, keeps inside ones', async () => {
        const late = booking('late', '16:00', '17:00');
        const partial = booking('partial', '13:30', '14:30');
        const inside = booking('inside', '10:00', '11:00');
        const edge = booking('edge', '13:00', '14:00');
        prisma.booking.findMany.mockResolvedValue([
          inside,
          edge,
          partial,
          late,
        ]);

        const result = await service.findConflicts(narrowed, admin);

        expect(result).toEqual([
          { ...partial, reason: 'OUTSIDE_HOURS' },
          { ...late, reason: 'OUTSIDE_HOURS' },
        ]);
      });
    });

    it('reports no conflicts when no day is non-working and no hours are given', async () => {
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
