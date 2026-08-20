import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// Отменённая запись не занимает время мастера; выполненная — занимала (реально была оказана), поэтому
// она по-прежнему учитывается при проверке пересечений (см. ТЗ: "проверка доступности мастера по времени").
const NON_BLOCKING_STATUSES: BookingStatus[] = [BookingStatus.CANCELLED];

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.CREATED]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.booking.create({
      data: {
        salonId: user.salonId,
        clientId: dto.clientId,
        masterId,
        serviceId: dto.serviceId,
        startTime,
        endTime,
      },
    });
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

    return this.prisma.booking.update({
      where: { id },
      data: { masterId, startTime, endTime },
    });
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

    return this.prisma.booking.update({
      where: { id },
      data: { status: dto.status },
    });
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
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        masterId,
        status: { notIn: NON_BLOCKING_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeBookingId && { id: { not: excludeBookingId } }),
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'Master already has an overlapping booking at this time',
      );
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

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
