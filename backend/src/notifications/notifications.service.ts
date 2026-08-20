import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Booking,
  Client,
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Service,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER } from './email/email-provider.interface';
import type {
  EmailMessage,
  EmailProvider,
} from './email/email-provider.interface';

type BookingWithRecipient = Booking & { client: Client; service: Service };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  // Booking создан → уведомление-подтверждение клиенту (см. ТЗ, раздел 3 "Функциональные требования")
  notifyBookingConfirmed(bookingId: string): Promise<void> {
    return this.createAndSend(bookingId, NotificationType.BOOKING_CONFIRMATION);
  }

  // Booking перенесён → уведомление о новом времени
  notifyBookingRescheduled(bookingId: string): Promise<void> {
    return this.createAndSend(bookingId, NotificationType.BOOKING_RESCHEDULED);
  }

  // Booking отменён → уведомление об отмене
  notifyBookingCancelled(bookingId: string): Promise<void> {
    return this.createAndSend(bookingId, NotificationType.BOOKING_CANCELLATION);
  }

  findAll(salonId: string, status?: NotificationStatus) {
    return this.prisma.notification.findMany({
      where: { booking: { salonId }, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, salonId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { AND: [{ id }, { booking: { salonId } }] },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  // Никогда не выбрасывает исключение наружу — сбой уведомления не должен ломать
  // основной сценарий (создание/перенос/отмену записи), только фиксируется как FAILED.
  private async createAndSend(
    bookingId: string,
    type: NotificationType,
  ): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        bookingId,
        type,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
      },
    });

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { client: true, service: true },
    });

    const recipientEmail = booking?.client.email;

    if (!booking || !recipientEmail) {
      await this.markFailed(notification.id);
      return;
    }

    try {
      await this.emailProvider.send(
        this.buildMessage(type, recipientEmail, booking),
      );
      await this.markSent(notification.id);
    } catch (error) {
      this.logger.warn(
        `Failed to send ${type} email for booking ${bookingId}: ${String(error)}`,
      );
      await this.markFailed(notification.id);
    }
  }

  private buildMessage(
    type: NotificationType,
    to: string,
    booking: BookingWithRecipient,
  ): EmailMessage {
    const when = booking.startTime.toISOString();

    switch (type) {
      case NotificationType.BOOKING_CONFIRMATION:
        return {
          to,
          subject: 'Ваша запись подтверждена',
          body: `Вы записаны на "${booking.service.name}" ${when}.`,
        };
      case NotificationType.BOOKING_RESCHEDULED:
        return {
          to,
          subject: 'Ваша запись перенесена',
          body: `Новое время записи на "${booking.service.name}": ${when}.`,
        };
      case NotificationType.BOOKING_CANCELLATION:
        return {
          to,
          subject: 'Ваша запись отменена',
          body: `Запись на "${booking.service.name}" (${when}) отменена.`,
        };
    }
  }

  private markSent(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  }

  private markFailed(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.FAILED },
    });
  }
}
