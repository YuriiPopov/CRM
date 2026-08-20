import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto, salonId: string) {
    if (!dto.consentGiven) {
      throw new BadRequestException(
        'Client consent to data processing is required',
      );
    }

    return this.prisma.client.create({
      data: {
        salonId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        tags: dto.tags ?? [],
        consentGivenAt: new Date(),
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.client.findMany({
      where: this.scopeWhere(user),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...this.scopeWhere(user) },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, dto: UpdateClientDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.consentWithdrawn && { consentWithdrawnAt: new Date() }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.assertExistsInSalon(id, salonId);

    try {
      await this.prisma.client.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete a client with existing bookings',
        );
      }
      throw error;
    }
  }

  private async assertExistsInSalon(
    id: string,
    salonId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id, salonId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  // ADMIN видит всех клиентов салона; MASTER — только клиентов по своим записям (см. ТЗ, раздел 2 "Роли пользователей")
  private scopeWhere(user: AuthenticatedUser): Prisma.ClientWhereInput {
    if (user.role === Role.ADMIN) {
      return { salonId: user.salonId };
    }

    if (!user.masterId) {
      return { id: '__none__' };
    }

    return {
      salonId: user.salonId,
      bookings: { some: { masterId: user.masterId } },
    };
  }
}
