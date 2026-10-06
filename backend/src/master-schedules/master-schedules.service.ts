import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { salonNow } from '../common/time/salon-time';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GetMasterScheduleQueryDto } from './dto/get-master-schedule-query.dto';
import { UpsertMasterScheduleDto } from './dto/upsert-master-schedule.dto';
import { dayRange, isDateInMonth, monthRange } from './master-schedule.util';

export type ConflictReason = 'DAY_OFF' | 'OUTSIDE_HOURS';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CREATED,
  BookingStatus.CONFIRMED,
];

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

// Минуты от полуночи дня `dayOf` (по умолчанию — самой даты); конец записи после полуночи
// даёт значение > 1440, т.е. гарантированно «после конца рабочего дня».
function minutesOfDay(date: Date, dayOf: Date = date): number {
  const dayStart = Date.UTC(
    dayOf.getUTCFullYear(),
    dayOf.getUTCMonth(),
    dayOf.getUTCDate(),
  );
  return Math.round((date.getTime() - dayStart) / 60000);
}

@Injectable()
export class MasterSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  // MASTER читает только свой график (мастер-приложение) — вне зависимости от query.masterId,
  // тот же приём self-scope, что и в MasterBlocksService.findAll/remove.
  async findMonth(query: GetMasterScheduleQueryDto, user: AuthenticatedUser) {
    if (user.role === Role.MASTER && query.masterId !== user.masterId) {
      throw new ForbiddenException('Masters can only read their own schedule');
    }
    await this.assertMasterInSalon(query.masterId, user.salonId);

    const { start, end } = monthRange(query.year, query.month);
    return this.prisma.masterSchedule.findMany({
      where: {
        salonId: user.salonId,
        masterId: query.masterId,
        date: { gte: start, lt: end },
      },
      orderBy: { date: 'asc' },
    });
  }

  // Upsert по каждому дню месяца из dto.days — дни, не переданные в массиве, не трогаются
  // (см. модель: отсутствие записи = "ещё не размечено", а не "выходной", см. schema.prisma).
  async upsertMonth(dto: UpsertMasterScheduleDto, user: AuthenticatedUser) {
    await this.assertMasterInSalon(dto.masterId, user.salonId);
    this.assertDaysBelongToMonth(dto);

    await this.prisma.$transaction(
      dto.days.map((day) =>
        this.prisma.masterSchedule.upsert({
          where: {
            masterId_date: {
              masterId: dto.masterId,
              date: new Date(`${day.date}T00:00:00.000Z`),
            },
          },
          create: {
            salonId: user.salonId,
            masterId: dto.masterId,
            date: new Date(`${day.date}T00:00:00.000Z`),
            isWorking: day.isWorking,
            startTime: day.isWorking ? (day.startTime ?? null) : null,
            endTime: day.isWorking ? (day.endTime ?? null) : null,
          },
          update: {
            isWorking: day.isWorking,
            startTime: day.isWorking ? (day.startTime ?? null) : null,
            endTime: day.isWorking ? (day.endTime ?? null) : null,
          },
        }),
      ),
    );

    return this.findMonth(
      { masterId: dto.masterId, year: dto.year, month: dto.month },
      user,
    );
  }

  // Активные (CREATED/CONFIRMED) будущие записи, конфликтующие с ПРЕДЛАГАЕМЫМ графиком из dto
  // (без сохранения): на день, который становится нерабочим (reason DAY_OFF), либо полностью/
  // частично за новыми часами рабочего дня (reason OUTSIDE_HOURS). «Будущие» считаем от
  // salonNow() — записи хранятся настенным временем салона (см. salon-time.ts). Нужно, чтобы
  // предупредить администратора до сохранения графика.
  async findConflicts(dto: UpsertMasterScheduleDto, user: AuthenticatedUser) {
    await this.assertMasterInSalon(dto.masterId, user.salonId);
    this.assertDaysBelongToMonth(dto);

    const checkableDays = dto.days.filter(
      (day) => !day.isWorking || (day.startTime && day.endTime),
    );
    if (checkableDays.length === 0) {
      return [];
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        salonId: user.salonId,
        masterId: dto.masterId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        startTime: { gte: salonNow() },
        OR: checkableDays.map((day) => {
          const { start, end } = dayRange(day.date);
          return { startTime: { gte: start, lt: end } };
        }),
      },
      orderBy: { startTime: 'asc' },
    });

    const dayByDate = new Map(checkableDays.map((day) => [day.date, day]));
    const conflicts: Array<
      (typeof bookings)[number] & { reason: ConflictReason }
    > = [];
    for (const booking of bookings) {
      const day = dayByDate.get(booking.startTime.toISOString().slice(0, 10));
      if (!day) continue;
      if (!day.isWorking) {
        conflicts.push({ ...booking, reason: 'DAY_OFF' });
      } else if (
        minutesOfDay(booking.startTime) < parseHm(day.startTime!) ||
        minutesOfDay(booking.endTime, booking.startTime) > parseHm(day.endTime!)
      ) {
        conflicts.push({ ...booking, reason: 'OUTSIDE_HOURS' });
      }
    }
    return conflicts;
  }

  private async assertMasterInSalon(
    masterId: string,
    salonId: string,
  ): Promise<void> {
    const master = await this.prisma.master.findFirst({
      where: { id: masterId, salonId },
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }
  }

  private assertDaysBelongToMonth(dto: UpsertMasterScheduleDto): void {
    const hasMismatch = dto.days.some(
      (day) => !isDateInMonth(day.date, dto.year, dto.month),
    );
    if (hasMismatch) {
      throw new BadRequestException(
        'All days must belong to the specified year/month',
      );
    }
  }
}
