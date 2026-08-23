import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  findOverlappingBlock,
  findOverlappingBooking,
} from '../bookings/booking-overlap.util';
import { CreateMasterBlockDto } from './dto/create-master-block.dto';
import { ListMasterBlocksQueryDto } from './dto/list-master-blocks-query.dto';

@Injectable()
export class MasterBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMasterBlockDto, user: AuthenticatedUser) {
    const masterId = this.resolveMasterIdForCreate(dto, user);

    const master = await this.prisma.master.findFirst({
      where: { id: masterId, salonId: user.salonId },
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // Конфликт с уже существующими активными записями — запрет (уточнено с владельцем продукта,
    // Backlog п.9): блокировку нельзя поставить поверх записи, её нужно сперва перенести/отменить.
    const overlappingBooking = await findOverlappingBooking(
      this.prisma,
      masterId,
      startTime,
      endTime,
    );
    if (overlappingBooking) {
      throw new ConflictException(
        'Cannot block this time: master has active bookings during this period',
      );
    }

    const overlappingBlock = await findOverlappingBlock(
      this.prisma,
      masterId,
      startTime,
      endTime,
    );
    if (overlappingBlock) {
      throw new ConflictException(
        'This time is already blocked for the master',
      );
    }

    return this.prisma.masterBlock.create({
      data: {
        salonId: user.salonId,
        masterId,
        startTime,
        endTime,
        reason: dto.reason,
      },
    });
  }

  // ADMIN видит блокировки всего салона (опционально отфильтрованные по мастеру);
  // MASTER — только свои, вне зависимости от query.masterId (тот же приём, что в BookingsService.scopeWhere)
  findAll(query: ListMasterBlocksQueryDto, user: AuthenticatedUser) {
    const where: Prisma.MasterBlockWhereInput = { salonId: user.salonId };

    if (user.role === Role.MASTER) {
      where.masterId = user.masterId ?? '__none__';
    } else if (query.masterId) {
      where.masterId = query.masterId;
    }

    if (query.from) {
      where.endTime = { gt: new Date(query.from) };
    }
    if (query.to) {
      where.startTime = { lt: new Date(query.to) };
    }

    return this.prisma.masterBlock.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const block = await this.prisma.masterBlock.findFirst({
      where: { id, salonId: user.salonId },
    });

    if (!block) {
      throw new NotFoundException('Block not found');
    }

    if (user.role === Role.MASTER && block.masterId !== user.masterId) {
      throw new ForbiddenException('Masters can only remove their own blocks');
    }

    await this.prisma.masterBlock.delete({ where: { id } });
  }

  private resolveMasterIdForCreate(
    dto: CreateMasterBlockDto,
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
          'Masters can only block time for themselves',
        );
      }
      return user.masterId;
    }

    if (!dto.masterId) {
      throw new BadRequestException('masterId is required');
    }
    return dto.masterId;
  }
}
