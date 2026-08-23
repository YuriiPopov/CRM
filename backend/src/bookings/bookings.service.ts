import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  addMinutes,
  BOOKING_BUFFER_MINUTES,
  findOverlappingBlock,
  findOverlappingBooking,
} from './booking-overlap.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.CREATED]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateBookingDto, user: AuthenticatedUser) {
    const masterId = this.resolveMasterIdForCreate(dto, user);

    const [client, master, service] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: dto.clientId, salonId: user.salonId },
      }),
      this.prisma.master.findFirst({
        where: { id: masterId, salonId: user.salonId },
      }),
      this.prisma.service.findFirst({
        where: { id: dto.serviceId, salonId: user.salonId },
      }),
    ]);

    if (!client) throw new NotFoundException('Client not found');
    if (!master) throw new NotFoundException('Master not found');
    if (!service) throw new NotFoundException('Service not found');

    const startTime = new Date(dto.startTime);
    const endTime = addMinutes(startTime, service.durationMin);

    await this.assertNoOverlap(masterId, startTime, endTime);

    const booking = await this.prisma.booking.create({
      data: {
        salonId: user.salonId,
        clientId: dto.clientId,
        masterId,
        serviceId: dto.serviceId,
        startTime,
        endTime,
      },
    });

    await this.notifySafely(() =>
      this.notificationsService.notifyBookingConfirmed(booking.id),
    );

    return booking;
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.booking.findMany({
      where: this.scopeWhere(user),
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user)] },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  // Перенос времени/мастера — только ADMIN (см. RolesGuard на контроллере)
  async reschedule(id: string, dto: RescheduleBookingDto, salonId: string) {
    const booking = await this.getInSalon(id, salonId);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new ConflictException(
        `Cannot reschedule a booking with status ${booking.status}`,
      );
    }

    const masterId = dto.masterId ?? booking.masterId;
    if (dto.masterId) {
      const master = await this.prisma.master.findFirst({
        where: { id: dto.masterId, salonId },
      });
      if (!master) throw new NotFoundException('Master not found');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: booking.serviceId },
    });
    // FK-гарантия: у существующей записи сервис не может отсутствовать
    const startTime = new Date(dto.startTime);
    const endTime = addMinutes(startTime, service!.durationMin);

    await this.assertNoOverlap(masterId, startTime, endTime, id);

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { masterId, startTime, endTime },
    });

    await this.notifySafely(() =>
      this.notificationsService.notifyBookingRescheduled(updated.id),
    );

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    user: AuthenticatedUser,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user)] },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // MASTER "отмечает выполнение/отмену" своих записей — подтверждение (CONFIRMED) остаётся за ADMIN
    if (
      user.role === Role.MASTER &&
      dto.status !== BookingStatus.COMPLETED &&
      dto.status !== BookingStatus.CANCELLED
    ) {
      throw new ForbiddenException(
        'Masters can only complete or cancel their own bookings',
      );
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[booking.status];
    if (!allowedNext.includes(dto.status)) {
      throw new ConflictException(
        `Cannot transition booking from ${booking.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: dto.status },
    });

    if (dto.status === BookingStatus.CANCELLED) {
      await this.notifySafely(() =>
        this.notificationsService.notifyBookingCancelled(updated.id),
      );
    }

    return updated;
  }

  private resolveMasterIdForCreate(
    dto: CreateBookingDto,
    user: AuthenticatedUser,
  ): string {
    if (user.role === Role.MASTER) {
      if (!user.masterId) {
        throw new ForbiddenException(
          'Your account is not linked to a master profile',
        );
      }
      if (dto.masterId && dto.masterId !== user.masterId) {
        throw new ForbiddenException(
          'Masters can only create bookings for themselves',
        );
      }
      return user.masterId;
    }

    if (!dto.masterId) {
      throw new BadRequestException('masterId is required');
    }
    return dto.masterId;
  }

  private async getInSalon(id: string, salonId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, salonId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async assertNoOverlap(
    masterId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    // Буферное время между записями (Backlog п.10) — фиксированный зазор на весь салон,
    // проверяется наравне с прямым пересечением (см. findOverlappingBooking).
    const overlapping = await findOverlappingBooking(
      this.prisma,
      masterId,
      startTime,
      endTime,
      excludeBookingId,
      BOOKING_BUFFER_MINUTES,
    );

    if (overlapping) {
      throw new ConflictException(
        'Master already has an overlapping booking at this time',
      );
    }

    // Резервирование времени мастера (Backlog п.9, MasterBlock) — недоступен для записи,
    // пока действует блокировка (выходной/отпуск/перерыв), наравне с другими записями.
    const overlappingBlock = await findOverlappingBlock(
      this.prisma,
      masterId,
      startTime,
      endTime,
    );

    if (overlappingBlock) {
      throw new ConflictException(
        'Master is unavailable at this time (schedule blocked)',
      );
    }
  }

  // Уведомления — второстепенный эффект: их сбой не должен откатывать/ломать сам сценарий записи
  private async notifySafely(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.logger.warn(`Notification dispatch failed: ${String(error)}`);
    }
  }

  // ADMIN видит все записи салона; MASTER — только свои (см. ТЗ, раздел 2 "Роли пользователей")
  private scopeWhere(user: AuthenticatedUser): Prisma.BookingWhereInput {
    if (user.role === Role.ADMIN) {
      return { salonId: user.salonId };
    }

    if (!user.masterId) {
      return { id: '__none__' };
    }

    return { salonId: user.salonId, masterId: user.masterId };
  }
}
