import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMasterDto, salonId: string) {
    return this.prisma.master.create({
      data: {
        salonId,
        name: dto.name,
        specialization: dto.specialization,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.master.findMany({
      where: this.scopeWhere(user),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    // scopeWhere() can itself carry an `id` (MASTER scope) — merge via AND rather than
    // object-spread, which would let scopeWhere's `id` silently overwrite the requested one.
    const master = await this.prisma.master.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user)] },
      include: { services: { include: { service: true } } },
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const { services, ...rest } = master;
    return { ...rest, services: services.map((link) => link.service) };
  }

  async update(id: string, dto: UpdateMasterDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);

    return this.prisma.master.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.specialization !== undefined && {
          specialization: dto.specialization,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.assertExistsInSalon(id, salonId);

    try {
      await this.prisma.master.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete a master with a linked user account, bookings, or assigned services',
        );
      }
      throw error;
    }
  }

  // Привязка услуги к мастеру — идемпотентна (повторная привязка не ошибка)
  async assignService(masterId: string, serviceId: string, salonId: string) {
    await this.assertExistsInSalon(masterId, salonId);
    await this.assertServiceInSalon(serviceId, salonId);

    return this.prisma.masterService.upsert({
      where: { masterId_serviceId: { masterId, serviceId } },
      update: {},
      create: { masterId, serviceId },
    });
  }

  async unassignService(
    masterId: string,
    serviceId: string,
    salonId: string,
  ): Promise<void> {
    await this.assertExistsInSalon(masterId, salonId);

    const link = await this.prisma.masterService.findUnique({
      where: { masterId_serviceId: { masterId, serviceId } },
    });

    if (!link) {
      throw new NotFoundException('Service is not assigned to this master');
    }

    await this.prisma.masterService.delete({
      where: { masterId_serviceId: { masterId, serviceId } },
    });
  }

  private async assertExistsInSalon(
    id: string,
    salonId: string,
  ): Promise<void> {
    const master = await this.prisma.master.findFirst({
      where: { id, salonId },
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }
  }

  private async assertServiceInSalon(
    id: string,
    salonId: string,
  ): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id, salonId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }
  }

  // ADMIN видит весь штат салона; MASTER — только свою собственную карточку (см. ТЗ, раздел 2 "Роли пользователей")
  private scopeWhere(user: AuthenticatedUser): Prisma.MasterWhereInput {
    if (user.role === Role.ADMIN) {
      return { salonId: user.salonId };
    }

    if (!user.masterId) {
      return { id: '__none__' };
    }

    return { salonId: user.salonId, id: user.masterId };
  }
}
