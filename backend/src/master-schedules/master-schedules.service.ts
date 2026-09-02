import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NON_BLOCKING_BOOKING_STATUSES } from '../bookings/booking-overlap.util';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GetMasterScheduleQueryDto } from './dto/get-master-schedule-query.dto';
import { UpsertMasterScheduleDto } from './dto/upsert-master-schedule.dto';
import { dayRange, isDateInMonth, monthRange } from './master-schedule.util';

@Injectable()
export class MasterSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMonth(query: GetMasterScheduleQueryDto, user: AuthenticatedUser) {
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

  // Записи, конфликтующие с ПРЕДЛАГАЕМЫМ графиком из dto (без сохранения) — попадающие на день,
  // который в этом графике становится нерабочим. Нужно подзадаче №35/36, чтобы предупредить
  // администратора до сохранения графика.
  async findConflicts(dto: UpsertMasterScheduleDto, user: AuthenticatedUser) {
    await this.assertMasterInSalon(dto.masterId, user.salonId);
    this.assertDaysBelongToMonth(dto);

    const becomingNonWorking = dto.days.filter((day) => !day.isWorking);
    if (becomingNonWorking.length === 0) {
      return [];
    }

    return this.prisma.booking.findMany({
      where: {
        salonId: user.salonId,
        masterId: dto.masterId,
        status: { notIn: NON_BLOCKING_BOOKING_STATUSES },
        OR: becomingNonWorking.map((day) => {
          const { start, end } = dayRange(day.date);
          return { startTime: { gte: start, lt: end } };
        }),
      },
      orderBy: { startTime: 'asc' },
    });
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
