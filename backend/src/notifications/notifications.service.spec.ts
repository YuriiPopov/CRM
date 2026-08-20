import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER } from './email/email-provider.interface';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    booking: { findUnique: jest.Mock };
  };
  let emailProvider: { send: jest.Mock };

  const booking = {
    id: 'booking-1',
    startTime: new Date('2026-01-10T10:00:00.000Z'),
    client: { email: 'client@example.com' },
    service: { name: 'Manicure' },
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      booking: { findUnique: jest.fn() },
    };
    emailProvider = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('notifyBookingConfirmed', () => {
    it('creates a PENDING record, sends the email, then marks it SENT', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue(booking);

      await service.notifyBookingConfirmed('booking-1');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-1',
          type: NotificationType.BOOKING_CONFIRMATION,
          channel: NotificationChannel.EMAIL,
          status: NotificationStatus.PENDING,
        },
      });
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'client@example.com' }),
      );
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date) as Date,
        },
      });
    });

    it('marks the notification FAILED when the client has no email, without calling the provider', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue({
        ...booking,
        client: { email: null },
      });

      await service.notifyBookingConfirmed('booking-1');

      expect(emailProvider.send).not.toHaveBeenCalled();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it('marks the notification FAILED when the email provider throws', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue(booking);
      emailProvider.send.mockRejectedValue(new Error('SMTP down'));

      await service.notifyBookingConfirmed('booking-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { status: NotificationStatus.FAILED },
      });
    });

    it('never throws, even when the provider fails', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue(booking);
      emailProvider.send.mockRejectedValue(new Error('SMTP down'));

      await expect(
        service.notifyBookingConfirmed('booking-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('notifyBookingRescheduled / notifyBookingCancelled', () => {
    it('stamps the correct type for a reschedule notification', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue(booking);

      await service.notifyBookingRescheduled('booking-1');

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
          data: expect.objectContaining({
            type: NotificationType.BOOKING_RESCHEDULED,
          }),
        }),
      );
    });

    it('stamps the correct type for a cancellation notification', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notification-1' });
      prisma.booking.findUnique.mockResolvedValue(booking);

      await service.notifyBookingCancelled('booking-1');

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
          data: expect.objectContaining({
            type: NotificationType.BOOKING_CANCELLATION,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('scopes to the salon and applies an optional status filter', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findAll('salon-1', NotificationStatus.FAILED);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          booking: { salonId: 'salon-1' },
          status: NotificationStatus.FAILED,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omits the status filter when none is given', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findAll('salon-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { booking: { salonId: 'salon-1' } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the notification is out of scope', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('notification-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the notification when found in scope', async () => {
      const found = { id: 'notification-1' };
      prisma.notification.findFirst.mockResolvedValue(found);

      await expect(service.findOne('notification-1', 'salon-1')).resolves.toBe(
        found,
      );
    });
  });
});
