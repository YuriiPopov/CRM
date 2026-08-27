import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto, salonId: string) {
    await this.assertCategoryInSalon(dto.categoryId, salonId);

    return this.prisma.service.create({
      data: {
        salonId,
        name: dto.name,
        categoryId: dto.categoryId,
        durationMin: dto.durationMin,
        price: dto.price,
      },
    });
  }

  // Каталог услуг общий для всей команды салона — ADMIN и MASTER читают один и тот же список (см. ТЗ, раздел 2)
  findAll(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, salonId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async update(id: string, dto: UpdateServiceDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryInSalon(dto.categoryId, salonId);
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.durationMin !== undefined && { durationMin: dto.durationMin }),
        ...(dto.price !== undefined && { price: dto.price }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.assertExistsInSalon(id, salonId);

    try {
      await this.prisma.service.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete a service that is still referenced by masters, materials, or bookings',
        );
      }
      throw error;
    }
  }

  private async assertExistsInSalon(
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

  private async assertCategoryInSalon(
    categoryId: string,
    salonId: string,
  ): Promise<void> {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, salonId },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }
  }
}
