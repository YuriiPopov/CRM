import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';

@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(salonId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { salonId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, salonId: string) {
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id, salonId },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    return category;
  }

  create(dto: CreateServiceCategoryDto, salonId: string) {
    if (dto.isDefault) {
      return this.prisma
        .$transaction([
          this.prisma.serviceCategory.updateMany({
            where: { salonId },
            data: { isDefault: false },
          }),
          this.prisma.serviceCategory.create({
            data: { salonId, name: dto.name, isDefault: true },
          }),
        ])
        .then(([, category]) => category);
    }

    return this.prisma.serviceCategory.create({
      data: { salonId, name: dto.name, isDefault: false },
    });
  }

  async update(id: string, dto: UpdateServiceCategoryDto, salonId: string) {
    const current = await this.findOne(id, salonId);

    if (dto.isDefault === false && current.isDefault) {
      throw new BadRequestException(
        'Cannot unset the default category directly — mark a different category as default instead',
      );
    }

    if (dto.isDefault === true) {
      const [, category] = await this.prisma.$transaction([
        this.prisma.serviceCategory.updateMany({
          where: { salonId, NOT: { id } },
          data: { isDefault: false },
        }),
        this.prisma.serviceCategory.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            isDefault: true,
          },
        }),
      ]);
      return category;
    }

    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    const current = await this.findOne(id, salonId);

    if (current.isDefault) {
      throw new ConflictException(
        'Cannot delete the default category — mark a different category as default first',
      );
    }

    const defaultCategory = await this.prisma.serviceCategory.findFirst({
      where: { salonId, isDefault: true },
    });

    if (!defaultCategory) {
      throw new ConflictException(
        'No default category configured for this salon — cannot reassign references before deletion',
      );
    }

    // A master already assigned to both the deleted category and the default
    // category would collide on MasterSpecialization's composite PK if we just
    // updateMany'd every affected row onto defaultCategory.id — drop those
    // would-be duplicates first, then reassign the rest.
    const affected = await this.prisma.masterSpecialization.findMany({
      where: { categoryId: id },
    });
    const alreadyHasDefault = await this.prisma.masterSpecialization.findMany({
      where: {
        categoryId: defaultCategory.id,
        masterId: { in: affected.map((a) => a.masterId) },
      },
    });
    const alreadyHasDefaultMasterIds = alreadyHasDefault.map((a) => a.masterId);

    await this.prisma.$transaction([
      this.prisma.service.updateMany({
        where: { categoryId: id },
        data: { categoryId: defaultCategory.id },
      }),
      this.prisma.masterSpecialization.deleteMany({
        where: {
          categoryId: id,
          masterId: { in: alreadyHasDefaultMasterIds },
        },
      }),
      this.prisma.masterSpecialization.updateMany({
        where: { categoryId: id },
        data: { categoryId: defaultCategory.id },
      }),
      this.prisma.serviceCategory.delete({ where: { id } }),
    ]);
  }
}
