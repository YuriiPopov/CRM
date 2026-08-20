import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingSource, Client, Master, Service } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addMinutes,
  findOverlappingBooking,
  NON_BLOCKING_BOOKING_STATUSES,
} from '../bookings/booking-overlap.util';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CreatePublicBookingDto } from './dto/create-public-booking.dto';

// MVP-упрощение: единые часы работы салона в UTC вместо полноценной модели расписания
// (Master/Salon такой модели пока не несут — см. schema.prisma). Не блокирует добавление
// per-salon/per-master расписания позже — вся логика инкапсулирована в этом сервисе.
const SALON_OPEN_HOUR_UTC = 9;
const SALON_CLOSE_HOUR_UTC = 20;
const SLOT_STEP_MINUTES = 15;

export interface AvailableSlot {
  startTime: string;
  endTime: string;
}

@Injectable()
export class PublicBookingService {
  constructor(private readonly prisma: PrismaService) {}

  // Отдаёт только свободные слоты — ни список существующих записей, ни их клиентов
  // (см. требование "не раскрывать чужие данные").
  async getAvailableSlots(query: AvailableSlotsQueryDto): Promise<{
    date: string;
    masterId: string;
    serviceId: string;
    slots: AvailableSlot[];
  }> {
    const { master, service } = await this.resolveBookableMasterService(
      query.masterId,
      query.serviceId,
    );

    const dayStart = this.parseDateOnly(query.date);
    const windowStart = new Date(dayStart);
    windowStart.setUTCHours(SALON_OPEN_HOUR_UTC, 0, 0, 0);
    const windowEnd = new Date(dayStart);
    windowEnd.setUTCHours(SALON_CLOSE_HOUR_UTC, 0, 0, 0);

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        masterId: master.id,
        status: { notIn: NON_BLOCKING_BOOKING_STATUSES },
        startTime: { lt: windowEnd },
        endTime: { gt: windowStart },
      },
      select: { startTime: true, endTime: true },
    });

    const now = new Date();
    const slots: AvailableSlot[] = [];

    for (
      let slotStart = new Date(windowStart);
      addMinutes(slotStart, service.durationMin) <= windowEnd;
      slotStart = addMinutes(slotStart, SLOT_STEP_MINUTES)
    ) {
      if (slotStart < now) continue;

      const slotEnd = addMinutes(slotStart, service.durationMin);
      const overlaps = existingBookings.some(
        (booking) => booking.startTime < slotEnd && booking.endTime > slotStart,
      );

      if (!overlaps) {
        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
        });
      }
    }

    return {
      date: query.date,
      masterId: master.id,
      serviceId: service.id,
      slots,
    };
  }

  async createBooking(dto: CreatePublicBookingDto) {
    if (!dto.consentGiven) {
      throw new BadRequestException(
        'Client consent to data processing is required',
      );
    }

    const { master, service } = await this.resolveBookableMasterService(
      dto.masterId,
      dto.serviceId,
    );

    const startTime = new Date(dto.startTime);
    if (startTime.getTime() < Date.now()) {
      throw new BadRequestException('Cannot book a time in the past');
    }
    const endTime = addMinutes(startTime, service.durationMin);

    const overlapping = await findOverlappingBooking(
      this.prisma,
      master.id,
      startTime,
      endTime,
    );
    if (overlapping) {
      throw new ConflictException('This time slot is no longer available');
    }

    const client = await this.resolveClient(master.salonId, dto);

    const booking = await this.prisma.booking.create({
      data: {
        salonId: master.salonId,
        clientId: client.id,
        masterId: master.id,
        serviceId: service.id,
        startTime,
        endTime,
        source: BookingSource.ONLINE,
      },
    });

    // Ответ клиенту — только его собственная только что созданная запись, без внутренних деталей салона
    return {
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    };
  }

  private async resolveBookableMasterService(
    masterId: string,
    serviceId: string,
  ): Promise<{ master: Master; service: Service }> {
    const master = await this.prisma.master.findFirst({
      where: { id: masterId, isActive: true },
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId: master.salonId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const link = await this.prisma.masterService.findUnique({
      where: {
        masterId_serviceId: { masterId: master.id, serviceId: service.id },
      },
    });
    if (!link) {
      throw new NotFoundException(
        'This master does not offer the requested service',
      );
    }

    return { master, service };
  }

  private async resolveClient(
    salonId: string,
    dto: CreatePublicBookingDto,
  ): Promise<Client> {
    const existing = await this.prisma.client.findFirst({
      where: { salonId, phone: dto.clientPhone },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.client.create({
      data: {
        salonId,
        name: dto.clientName,
        phone: dto.clientPhone,
        email: dto.clientEmail,
        consentGivenAt: new Date(),
      },
    });
  }

  private parseDateOnly(date: string): Date {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return parsed;
  }
}
