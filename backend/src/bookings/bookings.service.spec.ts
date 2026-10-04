import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingSource, BookingStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    client: { findFirst: jest.Mock };
    master: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
    booking: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    masterBlock: { findFirst: jest.Mock };
    masterSchedule: { findFirst: jest.Mock };
    masterService: { findUnique: jest.Mock };
  };
  let notifications: {
    notifyBookingConfirmed: jest.Mock;
    notifyBookingRescheduled: jest.Mock;
    notifyBookingCancelled: jest.Mock;
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
      client: { findFirst: jest.fn() },
      master: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      booking: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      masterBlock: { findFirst: jest.fn() },
      masterSchedule: { findFirst: jest.fn() },
      masterService: { findUnique: jest.fn() },
    };
    // По умолчанию блокировок нет — тесты, которым нужен конфликт с MasterBlock,
    // переопределяют это значение явно (см. describe('MasterBlock overlap')).
    prisma.masterBlock.findFirst.mockResolvedValue(null);
    // По умолчанию график не настроен ("не размечено") — не блокирует; тесты на график
    // (см. describe('MasterSchedule availability')) переопределяют это значение явно.
    prisma.masterSchedule.findFirst.mockResolvedValue(null);
    notifications = {
      notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
      notifyBookingRescheduled: jest.fn().mockResolvedValue(undefined),
      notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  const baseCreateDto = {
    clientId: 'client-1',
    serviceId: 'service-1',
    startTime: '2026-01-10T10:00:00.000Z',
  };

  describe('create', () => {
    it('lets ADMIN create a booking for a specific master', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null); // no overlap
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });

      await service.create(
        { ...baseCreateDto, masterId: 'master-rec-1' },
        admin,
      );

      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: {
          salonId: 'salon-1',
          clientId: 'client-1',
          masterId: 'master-rec-1',
          serviceId: 'service-1',
          startTime: new Date('2026-01-10T10:00:00.000Z'),
          endTime: new Date('2026-01-10T11:00:00.000Z'),
        },
      });
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    it('does not fail booking creation when the notification dispatch throws', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });
      notifications.notifyBookingConfirmed.mockRejectedValue(
        new Error('email provider down'),
      );

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).resolves.toEqual({ id: 'booking-1' });
    });

    it('rejects ADMIN creation without a masterId', async () => {
      await expect(service.create(baseCreateDto, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('lets MASTER create a booking for themselves without specifying masterId', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 30,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });

      await service.create(baseCreateDto, master);

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
          data: expect.objectContaining({ masterId: 'master-rec-1' }),
        }),
      );
    });

    it('rejects MASTER creating a booking for another master', async () => {
      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-2' }, master),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects a MASTER account with no linked master profile', async () => {
      await expect(
        service.create(baseCreateDto, { ...master, masterId: null }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the client is not in the salon', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the master has an overlapping active booking', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes ADMIN to the whole salon', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(admin);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        orderBy: { startTime: 'asc' },
      });
    });

    it('scopes MASTER to their own bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(master);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', masterId: 'master-rec-1' },
        orderBy: { startTime: 'asc' },
      });
    });

    it('narrows the ADMIN scope by source, status and from', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(admin, {
        source: BookingSource.ONLINE,
        status: BookingStatus.CREATED,
        from: '2026-03-10T00:00:00.000Z',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          source: BookingSource.ONLINE,
          status: BookingStatus.CREATED,
          startTime: { gte: new Date('2026-03-10T00:00:00.000Z') },
        },
        orderBy: { startTime: 'asc' },
      });
    });

    it('narrows the ADMIN scope by clientId and masterId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(admin, {
        clientId: 'client-1',
        masterId: 'master-rec-2',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          clientId: 'client-1',
          masterId: 'master-rec-2',
        },
        orderBy: { startTime: 'asc' },
      });
    });

    it('does not let a MASTER widen the scope with another masterId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(master, { masterId: 'someone-else' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', masterId: 'master-rec-1' },
        orderBy: { startTime: 'asc' },
      });
    });

    it('keeps the MASTER scope when filters are applied', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll(master, { source: BookingSource.ONLINE });

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          masterId: 'master-rec-1',
          source: BookingSource.ONLINE,
        },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  describe('countPendingOnline', () => {
    it('counts future ONLINE bookings in CREATED status of the given salon in the database', async () => {
      prisma.booking.count.mockResolvedValue(3);
      const before = Date.now();

      const result = await service.countPendingOnline('salon-1');

      expect(result).toEqual({ count: 3 });
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      const [{ where }] = prisma.booking.count.mock.calls[0] as [
        {
          where: {
            salonId: string;
            source: BookingSource;
            status: BookingStatus;
            startTime: { gte: Date };
          };
        },
      ];
      expect(where).toMatchObject({
        salonId: 'salon-1',
        source: BookingSource.ONLINE,
        status: BookingStatus.CREATED,
      });
      expect(where.startTime.gte.getTime()).toBeGreaterThanOrEqual(before);
      expect(where.startTime.gte.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when out of scope', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.findOne('booking-1', master)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reschedule', () => {
    it('throws NotFoundException when the booking is not in the salon', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T12:00:00.000Z' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects rescheduling a cancelled booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        salonId: 'salon-1',
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T12:00:00.000Z' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects rescheduling a completed booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        salonId: 'salon-1',
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T12:00:00.000Z' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('excludes the booking itself from the overlap check and recomputes endTime', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'booking-1',
          salonId: 'salon-1',
          masterId: 'master-rec-1',
          serviceId: 'service-1',
          status: BookingStatus.CREATED,
        })
        .mockResolvedValueOnce(null); // no overlap
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 45,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.reschedule(
        'booking-1',
        { startTime: '2026-01-10T12:00:00.000Z' },
        'salon-1',
      );

      // Буферное время между записями (Backlog п.10) — окно проверки раздвинуто на
      // BOOKING_BUFFER_MINUTES (10 мин) с обеих сторон относительно нового startTime/endTime.
      expect(prisma.booking.findFirst).toHaveBeenLastCalledWith({
        where: {
          masterId: 'master-rec-1',
          status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
          startTime: { lt: new Date('2026-01-10T12:55:00.000Z') },
          endTime: { gt: new Date('2026-01-10T11:50:00.000Z') },
          id: { not: 'booking-1' },
        },
      });
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: {
          masterId: 'master-rec-1',
          startTime: new Date('2026-01-10T12:00:00.000Z'),
          endTime: new Date('2026-01-10T12:45:00.000Z'),
          rescheduledAt: expect.any(Date) as Date,
        },
      });
      expect(notifications.notifyBookingRescheduled).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    // Отметка "перенесено" на карточках записи (см. formatRescheduledAt на фронтенде) —
    // хранится только факт последнего переноса, истории не нужно (см. schema.prisma).
    it('stamps rescheduledAt with the current time in the same update as the reschedule', async () => {
      const now = new Date('2026-02-01T10:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      try {
        prisma.booking.findFirst
          .mockResolvedValueOnce({
            id: 'booking-1',
            salonId: 'salon-1',
            masterId: 'master-rec-1',
            serviceId: 'service-1',
            status: BookingStatus.CREATED,
          })
          .mockResolvedValueOnce(null);
        prisma.service.findFirst.mockResolvedValue({
          id: 'service-1',
          durationMin: 30,
        });
        prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

        await service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T12:00:00.000Z' },
          'salon-1',
        );

        expect(prisma.booking.update).toHaveBeenCalledWith(
          expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
            data: expect.objectContaining({ rescheduledAt: now }),
          }),
        );
      } finally {
        jest.useRealTimers();
      }
    });

    // Исходное время до переноса (Backlog item39) — заполняется один раз, при первом
    // reschedule(), и не трогается при последующих (см. schema.prisma).
    it('stamps originalStartTime/originalEndTime with the pre-reschedule values on the first reschedule', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'booking-1',
          salonId: 'salon-1',
          masterId: 'master-rec-1',
          serviceId: 'service-1',
          status: BookingStatus.CREATED,
          startTime: new Date('2026-01-10T09:00:00.000Z'),
          endTime: new Date('2026-01-10T09:45:00.000Z'),
          originalStartTime: null,
          originalEndTime: null,
        })
        .mockResolvedValueOnce(null); // no overlap
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 45,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.reschedule(
        'booking-1',
        { startTime: '2026-01-10T12:00:00.000Z' },
        'salon-1',
      );

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
          data: expect.objectContaining({
            originalStartTime: new Date('2026-01-10T09:00:00.000Z'),
            originalEndTime: new Date('2026-01-10T09:45:00.000Z'),
          }),
        }),
      );
    });

    it('does not overwrite an already-set originalStartTime/originalEndTime on a second reschedule', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'booking-1',
          salonId: 'salon-1',
          masterId: 'master-rec-1',
          serviceId: 'service-1',
          status: BookingStatus.CREATED,
          startTime: new Date('2026-01-10T12:00:00.000Z'),
          endTime: new Date('2026-01-10T12:45:00.000Z'),
          originalStartTime: new Date('2026-01-10T09:00:00.000Z'),
          originalEndTime: new Date('2026-01-10T09:45:00.000Z'),
        })
        .mockResolvedValueOnce(null); // no overlap
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 45,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.reschedule(
        'booking-1',
        { startTime: '2026-01-10T15:00:00.000Z' },
        'salon-1',
      );

      // rescheduledAt всё равно обновляется на каждый перенос (см. item26), а
      // originalStartTime/originalEndTime в data не попадают вовсе — уже заполнены раньше.
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: {
          masterId: 'master-rec-1',
          startTime: new Date('2026-01-10T15:00:00.000Z'),
          endTime: new Date('2026-01-10T15:45:00.000Z'),
          rescheduledAt: expect.any(Date) as Date,
        },
      });
    });

    it('rejects reassigning to a master outside the salon', async () => {
      prisma.booking.findFirst.mockResolvedValueOnce({
        id: 'booking-1',
        salonId: 'salon-1',
        masterId: 'master-rec-1',
        serviceId: 'service-1',
        status: BookingStatus.CREATED,
      });
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T12:00:00.000Z', masterId: 'master-rec-2' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when out of scope', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows ADMIN to confirm a created booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CREATED,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.updateStatus(
        'booking-1',
        { status: BookingStatus.CONFIRMED },
        admin,
      );

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.CONFIRMED },
      });
      expect(notifications.notifyBookingCancelled).not.toHaveBeenCalled();
    });

    it('rejects MASTER trying to confirm their own booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CREATED,
      });

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          master,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('allows MASTER to complete their own confirmed booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.updateStatus(
        'booking-1',
        { status: BookingStatus.COMPLETED },
        master,
      );

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.COMPLETED },
      });
      expect(notifications.notifyBookingCancelled).not.toHaveBeenCalled();
    });

    it('allows MASTER to cancel their own created booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CREATED,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.updateStatus(
        'booking-1',
        { status: BookingStatus.CANCELLED },
        master,
      );

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(notifications.notifyBookingCancelled).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    it('rejects an invalid transition (e.g. completed -> confirmed)', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          admin,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    describe('NO_SHOW (item74)', () => {
      const pastStart = new Date(Date.now() - 60 * 60_000);
      const futureStart = new Date(Date.now() + 60 * 60_000);

      it('allows ADMIN to mark a confirmed booking whose start time has passed', async () => {
        prisma.booking.findFirst.mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          startTime: pastStart,
        });
        prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

        await service.updateStatus(
          'booking-1',
          { status: BookingStatus.NO_SHOW },
          admin,
        );

        expect(prisma.booking.update).toHaveBeenCalledWith({
          where: { id: 'booking-1' },
          data: { status: BookingStatus.NO_SHOW },
        });
        expect(notifications.notifyBookingCancelled).not.toHaveBeenCalled();
      });

      it('rejects MASTER with 403 even for their own past confirmed booking', async () => {
        prisma.booking.findFirst.mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          startTime: pastStart,
        });

        await expect(
          service.updateStatus(
            'booking-1',
            { status: BookingStatus.NO_SHOW },
            master,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.booking.update).not.toHaveBeenCalled();
      });

      it('rejects with 400 when the booking has not started yet', async () => {
        prisma.booking.findFirst.mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CONFIRMED,
          startTime: futureStart,
        });

        await expect(
          service.updateStatus(
            'booking-1',
            { status: BookingStatus.NO_SHOW },
            admin,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.booking.update).not.toHaveBeenCalled();
      });

      it.each([
        BookingStatus.CREATED,
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
        BookingStatus.NO_SHOW,
      ])('rejects marking a %s booking as no-show', async (status) => {
        prisma.booking.findFirst.mockResolvedValue({
          id: 'booking-1',
          status,
          startTime: pastStart,
        });

        await expect(
          service.updateStatus(
            'booking-1',
            { status: BookingStatus.NO_SHOW },
            admin,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.booking.update).not.toHaveBeenCalled();
      });

      it.each([
        BookingStatus.CREATED,
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ])('rejects transitioning out of NO_SHOW to %s', async (status) => {
        prisma.booking.findFirst.mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.NO_SHOW,
          startTime: pastStart,
        });

        await expect(
          service.updateStatus('booking-1', { status }, admin),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.booking.update).not.toHaveBeenCalled();
      });
    });

    it('rejects transitioning out of a terminal cancelled state', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.updateStatus(
          'booking-1',
          { status: BookingStatus.CONFIRMED },
          admin,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // Буферное время между записями (Backlog п.10) — фиксированные 10 минут на весь салон,
  // проверяются наравне с прямым пересечением (см. assertNoOverlap/findOverlappingBooking).
  describe('booking buffer (Backlog п.10)', () => {
    it('queries overlap with a 10-minute buffer padding on create', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });

      await service.create(
        { ...baseCreateDto, masterId: 'master-rec-1' },
        admin,
      );

      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        where: expect.objectContaining({
          startTime: { lt: new Date('2026-01-10T11:10:00.000Z') },
          endTime: { gt: new Date('2026-01-10T09:50:00.000Z') },
        }),
      });
    });
  });

  // Резервирование времени мастера (Backlog п.9, MasterBlock) — учитывается наравне
  // с пересечением с другими записями (см. assertNoOverlap).
  describe('MasterBlock overlap', () => {
    it('rejects creating a booking that overlaps a schedule block', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null); // no booking overlap
      prisma.masterBlock.findFirst.mockResolvedValue({ id: 'block-1' });

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects rescheduling a booking onto a schedule block', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'booking-1',
          status: BookingStatus.CREATED,
          masterId: 'master-rec-1',
          serviceId: 'service-1',
        })
        .mockResolvedValueOnce(null); // no booking overlap at the new time
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.masterBlock.findFirst.mockResolvedValue({ id: 'block-1' });

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T10:00:00.000Z' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  // Регулярный график работы мастера (Backlog item28, подзадача №35) — MasterSchedule.
  describe('MasterSchedule availability', () => {
    it('rejects creating a booking on a day explicitly marked as non-working', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterSchedule.findFirst.mockResolvedValue({
        id: 'schedule-1',
        masterId: 'master-rec-1',
        date: new Date('2026-01-10T00:00:00.000Z'),
        isWorking: false,
        startTime: null,
        endTime: null,
      });

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
      expect(prisma.masterSchedule.findFirst).toHaveBeenCalledWith({
        where: {
          masterId: 'master-rec-1',
          date: new Date('2026-01-10T00:00:00.000Z'),
        },
      });
    });

    it('rejects creating a booking outside the working hours of a working day', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterSchedule.findFirst.mockResolvedValue({
        id: 'schedule-1',
        masterId: 'master-rec-1',
        date: new Date('2026-01-10T00:00:00.000Z'),
        isWorking: true,
        startTime: '11:00',
        endTime: '18:00',
      });

      // baseCreateDto.startTime = '2026-01-10T10:00:00.000Z' — раньше начала рабочего дня (11:00)
      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects a booking that ends after the working day is over', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 90,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterSchedule.findFirst.mockResolvedValue({
        id: 'schedule-1',
        masterId: 'master-rec-1',
        date: new Date('2026-01-10T00:00:00.000Z'),
        isWorking: true,
        startTime: '09:00',
        endTime: '11:00',
      });

      // 10:00 + 90 мин = 11:30, за пределами конца рабочего дня (11:00)
      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('allows a booking within the working hours of a working day', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });
      prisma.masterSchedule.findFirst.mockResolvedValue({
        id: 'schedule-1',
        masterId: 'master-rec-1',
        date: new Date('2026-01-10T00:00:00.000Z'),
        isWorking: true,
        startTime: '09:00',
        endTime: '18:00',
      });

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).resolves.toEqual({ id: 'booking-1' });
    });

    it('does not block a day with no schedule record at all ("not yet configured")', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });
      prisma.masterSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ ...baseCreateDto, masterId: 'master-rec-1' }, admin),
      ).resolves.toEqual({ id: 'booking-1' });
    });

    it('rejects rescheduling a booking onto a non-working day', async () => {
      prisma.booking.findFirst
        .mockResolvedValueOnce({
          id: 'booking-1',
          status: BookingStatus.CREATED,
          masterId: 'master-rec-1',
          serviceId: 'service-1',
        })
        .mockResolvedValueOnce(null);
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.masterSchedule.findFirst.mockResolvedValue({
        id: 'schedule-1',
        masterId: 'master-rec-1',
        date: new Date('2026-01-10T00:00:00.000Z'),
        isWorking: false,
        startTime: null,
        endTime: null,
      });

      await expect(
        service.reschedule(
          'booking-1',
          { startTime: '2026-01-10T10:00:00.000Z' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  // Клиентское мобильное приложение (client-portal)
  describe('createForClient', () => {
    const params = {
      salonId: 'salon-1',
      clientId: 'client-1',
      masterId: 'master-rec-1',
      serviceId: 'service-1',
      startTime: new Date(Date.now() + 86_400_000).toISOString(),
    };

    beforeEach(() => {
      prisma.master.findFirst.mockResolvedValue({ id: 'master-rec-1' });
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        durationMin: 60,
      });
      prisma.masterService.findUnique.mockResolvedValue({
        masterId: 'master-rec-1',
        serviceId: 'service-1',
      });
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'booking-1' });
    });

    it('creates an ONLINE booking for the client from the token', async () => {
      await service.createForClient(params);

      expect(prisma.master.findFirst).toHaveBeenCalledWith({
        where: { id: 'master-rec-1', salonId: 'salon-1', isActive: true },
      });
      expect(prisma.booking.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          clientId: 'client-1',
          salonId: 'salon-1',
          source: 'ONLINE',
        }),
      });
      expect(notifications.notifyBookingConfirmed).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    it('rejects a master who does not offer the service', async () => {
      prisma.masterService.findUnique.mockResolvedValue(null);
      await expect(service.createForClient(params)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects a time in the past', async () => {
      await expect(
        service.createForClient({
          ...params,
          startTime: new Date(Date.now() - 60_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an overlapping slot', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'other' });
      await expect(service.createForClient(params)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('cancelForClient', () => {
    const future = new Date(Date.now() + 86_400_000);

    it('cancels only the client own booking', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelForClient('booking-1', 'client-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'booking-1', clientId: 'client-1' },
      });
    });

    it('cancels an active future booking and notifies', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CREATED,
        startTime: future,
      });
      prisma.booking.update.mockResolvedValue({ id: 'booking-1' });

      await service.cancelForClient('booking-1', 'client-1');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { status: BookingStatus.CANCELLED },
      });
      expect(notifications.notifyBookingCancelled).toHaveBeenCalledWith(
        'booking-1',
      );
    });

    it('does not cancel a completed booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
        startTime: future,
      });
      await expect(
        service.cancelForClient('booking-1', 'client-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not cancel a booking that has already started', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        startTime: new Date(Date.now() - 60_000),
      });
      await expect(
        service.cancelForClient('booking-1', 'client-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });
});
