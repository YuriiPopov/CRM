import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingSource, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicBookingService } from './public-booking.service';

describe('PublicBookingService', () => {
  let service: PublicBookingService;
  let prisma: {
    master: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
    masterService: { findUnique: jest.Mock };
    booking: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    client: { findFirst: jest.Mock; create: jest.Mock };
    masterBlock: { findMany: jest.Mock; findFirst: jest.Mock };
    masterSchedule: { findFirst: jest.Mock };
  };

  const master = { id: 'master-1', salonId: 'salon-1', isActive: true };
  const service_ = { id: 'service-1', salonId: 'salon-1', durationMin: 60 };

  beforeEach(async () => {
    prisma = {
      master: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      masterService: { findUnique: jest.fn() },
      booking: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      client: { findFirst: jest.fn(), create: jest.fn() },
      masterBlock: { findMany: jest.fn(), findFirst: jest.fn() },
      masterSchedule: { findFirst: jest.fn() },
    };
    // По умолчанию блокировок нет (Backlog п.9) — тесты, которым нужен конфликт
    // с MasterBlock, переопределяют это значение явно.
    prisma.masterBlock.findMany.mockResolvedValue([]);
    prisma.masterBlock.findFirst.mockResolvedValue(null);
    // По умолчанию график не настроен ("не размечено", item51) — ведёт себя как раньше;
    // тесты про недоступность по графику переопределяют это значение явно.
    prisma.masterSchedule.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicBookingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PublicBookingService);
  });

  describe('getAvailableSlots', () => {
    const query = {
      masterId: 'master-1',
      serviceId: 'service-1',
      date: '2026-06-15',
    };

    it('throws NotFoundException for an inactive/missing master', async () => {
      prisma.master.findFirst.mockResolvedValue(null);

      await expect(service.getAvailableSlots(query)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the master does not offer the service', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue(null);

      await expect(service.getAvailableSlots(query)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a malformed date', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailableSlots({ ...query, date: '2026-99-99' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns free slots and excludes ones overlapping an existing booking', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      // Booked 10:00–11:00 UTC on the requested day
      prisma.booking.findMany.mockResolvedValue([
        {
          startTime: new Date('2099-06-15T10:00:00.000Z'),
          endTime: new Date('2099-06-15T11:00:00.000Z'),
        },
      ]);

      const result = await service.getAvailableSlots({
        ...query,
        date: '2099-06-15', // far future so "now" never filters out slots
      });

      const bookedSlot = result.slots.find(
        (s) => s.startTime === '2099-06-15T10:00:00.000Z',
      );
      expect(bookedSlot).toBeUndefined();

      // Не рядом с забронированным временем (10:00–11:00) — иначе попадёт в 10-минутную
      // буферную зону (Backlog п.10, см. отдельный describe ниже) и тест перестанет проверять
      // то, что заявлено. Салон открыт 09:00–19:00 UTC (SALON_OPEN_HOUR_UTC), так что берём
      // слот ближе к вечеру, а не перед открытием.
      const freeSlot = result.slots.find(
        (s) => s.startTime === '2099-06-15T15:00:00.000Z',
      );
      expect(freeSlot).toEqual({
        startTime: '2099-06-15T15:00:00.000Z',
        endTime: '2099-06-15T16:00:00.000Z',
      });
    });

    // Буферное время между записями (Backlog п.10) — фиксированные 10 минут на весь салон,
    // проверяются в getAvailableSlots наравне с прямым пересечением.
    describe('booking buffer (Backlog п.10)', () => {
      beforeEach(() => {
        prisma.master.findFirst.mockResolvedValue(master);
        prisma.service.findFirst.mockResolvedValue(service_);
        prisma.masterService.findUnique.mockResolvedValue({});
        // Booked 10:00–11:00 UTC
        prisma.booking.findMany.mockResolvedValue([
          {
            startTime: new Date('2099-06-15T10:00:00.000Z'),
            endTime: new Date('2099-06-15T11:00:00.000Z'),
          },
        ]);
      });

      it('excludes a slot that ends inside the 10-minute buffer before a booking', async () => {
        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        // 09:00–10:00 ends exactly when the booking starts — within the buffer, must be excluded
        expect(
          result.slots.find((s) => s.startTime === '2099-06-15T09:00:00.000Z'),
        ).toBeUndefined();
      });

      it('excludes a slot that starts inside the 10-minute buffer after a booking', async () => {
        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        // 11:00–12:00 starts exactly when the booking ends — within the buffer, must be excluded
        expect(
          result.slots.find((s) => s.startTime === '2099-06-15T11:00:00.000Z'),
        ).toBeUndefined();
      });

      it('offers a slot once it clears the buffer on both sides', async () => {
        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        // 11:15–12:15 starts 15 minutes after the booking ends — past the 10-minute buffer
        expect(
          result.slots.find((s) => s.startTime === '2099-06-15T11:15:00.000Z'),
        ).toEqual({
          startTime: '2099-06-15T11:15:00.000Z',
          endTime: '2099-06-15T12:15:00.000Z',
        });
      });
    });

    it('never returns the underlying bookings, only availability', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findMany.mockResolvedValue([
        {
          startTime: new Date('2099-06-15T10:00:00.000Z'),
          endTime: new Date('2099-06-15T11:00:00.000Z'),
        },
      ]);

      const result = await service.getAvailableSlots({
        ...query,
        date: '2099-06-15',
      });

      expect(JSON.stringify(result)).not.toContain('client');
      expect(result).not.toHaveProperty('bookings');
    });

    it('excludes slots that have already passed today', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findMany.mockResolvedValue([]);

      const past = new Date();
      past.setUTCHours(past.getUTCHours() - 1);
      const todayIso = past.toISOString().slice(0, 10);

      const result = await service.getAvailableSlots({
        ...query,
        date: todayIso,
      });

      const now = new Date();
      expect(
        result.slots.every((slot) => new Date(slot.startTime) >= now),
      ).toBe(true);
    });

    // item51 — недоступность по графику работ (MasterSchedule) на экране выбора слота.
    describe('regular work schedule (item51)', () => {
      beforeEach(() => {
        prisma.master.findFirst.mockResolvedValue(master);
        prisma.service.findFirst.mockResolvedValue(service_);
        prisma.masterService.findUnique.mockResolvedValue({});
        prisma.booking.findMany.mockResolvedValue([]);
      });

      it('returns no slots and isWorkingDay: false for a full day off', async () => {
        prisma.masterSchedule.findFirst.mockResolvedValue({
          isWorking: false,
          startTime: null,
          endTime: null,
        });

        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        expect(result.isWorkingDay).toBe(false);
        expect(result.slots).toEqual([]);
      });

      it('does not even query bookings/blocks for a full day off (short-circuits before the window)', async () => {
        prisma.masterSchedule.findFirst.mockResolvedValue({
          isWorking: false,
          startTime: null,
          endTime: null,
        });

        await service.getAvailableSlots({ ...query, date: '2099-06-15' });

        expect(prisma.booking.findMany).not.toHaveBeenCalled();
        expect(prisma.masterBlock.findMany).not.toHaveBeenCalled();
      });

      it('excludes slots outside startTime/endTime for a partially available day, keeping isWorkingDay: true', async () => {
        // Salon is open 09:00-19:00 UTC; master is only available 11:00-17:00 this day.
        prisma.masterSchedule.findFirst.mockResolvedValue({
          isWorking: true,
          startTime: '11:00',
          endTime: '17:00',
        });

        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        expect(result.isWorkingDay).toBe(true);
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T09:00:00.000Z'),
        ).toBe(false);
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T10:30:00.000Z'),
        ).toBe(false);
        // 16:00-17:00 is the last hour-long slot that still fits inside 11:00-17:00
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T16:00:00.000Z'),
        ).toBe(true);
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T16:15:00.000Z'),
        ).toBe(false);
      });

      it('does not widen the window past the salon hours when the schedule is looser on either side', async () => {
        // Master "works" 07:00-20:00, wider than the salon's 09:00-19:00 — salon hours still win.
        prisma.masterSchedule.findFirst.mockResolvedValue({
          isWorking: true,
          startTime: '07:00',
          endTime: '20:00',
        });

        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T08:00:00.000Z'),
        ).toBe(false);
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T18:00:00.000Z'),
        ).toBe(true);
      });

      it('behaves exactly as before ("not yet configured") when there is no schedule record for the date', async () => {
        prisma.masterSchedule.findFirst.mockResolvedValue(null);

        const result = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        expect(result.isWorkingDay).toBe(true);
        expect(
          result.slots.some((s) => s.startTime === '2099-06-15T09:00:00.000Z'),
        ).toBe(true);
      });

      it('does not change anything for a normal working day covering the full salon window', async () => {
        prisma.masterSchedule.findFirst.mockResolvedValue({
          isWorking: true,
          startTime: '09:00',
          endTime: '19:00',
        });

        const withSchedule = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        prisma.masterSchedule.findFirst.mockResolvedValue(null);
        const withoutSchedule = await service.getAvailableSlots({
          ...query,
          date: '2099-06-15',
        });

        expect(withSchedule.slots).toEqual(withoutSchedule.slots);
      });
    });
  });

  describe('createBooking', () => {
    const dto = {
      masterId: 'master-1',
      serviceId: 'service-1',
      startTime: '2099-06-15T10:00:00.000Z',
      clientName: 'Anna',
      clientPhone: '+48123123123',
      consentGiven: true,
    };

    it('rejects creation without explicit consent', async () => {
      await expect(
        service.createBooking({ ...dto, consentGiven: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects booking a time in the past', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});

      await expect(
        service.createBooking({
          ...dto,
          startTime: '2020-01-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects a slot that is no longer available', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createBooking(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('checks overlap with a 10-minute buffer padding (Backlog п.10)', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.masterBlock.findFirst.mockResolvedValue(null);
      prisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        salonId: 'salon-1',
      });
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        startTime: new Date(dto.startTime),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
      });

      await service.createBooking(dto);

      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        where: expect.objectContaining({
          startTime: { lt: new Date('2099-06-15T11:10:00.000Z') },
          endTime: { gt: new Date('2099-06-15T09:50:00.000Z') },
        }),
      });
    });

    it('reuses an existing client by phone within the salon instead of duplicating', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findFirst.mockResolvedValue(null);
      const existingClient = { id: 'client-1', salonId: 'salon-1' };
      prisma.client.findFirst.mockResolvedValue(existingClient);
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        startTime: new Date(dto.startTime),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
      });

      await service.createBooking(dto);

      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(prisma.booking.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          clientId: 'client-1',
          source: BookingSource.ONLINE,
        }),
      });
    });

    it('creates a new client with consentGivenAt when no match exists, and returns a minimal response', async () => {
      prisma.master.findFirst.mockResolvedValue(master);
      prisma.service.findFirst.mockResolvedValue(service_);
      prisma.masterService.findUnique.mockResolvedValue({});
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue({
        id: 'client-new',
        salonId: 'salon-1',
      });
      prisma.booking.create.mockResolvedValue({
        id: 'booking-1',
        startTime: new Date(dto.startTime),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        salonId: 'salon-1',
        clientId: 'client-new',
      });

      const result = await service.createBooking(dto);

      expect(prisma.client.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          name: 'Anna',
          phone: '+48123123123',
          consentGivenAt: expect.any(Date) as Date,
        }),
      });
      expect(result).toEqual({
        id: 'booking-1',
        startTime: new Date(dto.startTime),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
      });
      expect(result).not.toHaveProperty('salonId');
      expect(result).not.toHaveProperty('clientId');
    });
  });
});
