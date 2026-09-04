import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { UploadMasterPhotoDto } from './dto/upload-master-photo.dto';

const masterInclude = {
  services: { include: { service: true } },
  specializations: true,
} satisfies Prisma.MasterInclude;

// Лимит применяется к декодированным байтам, не к длине base64-строки (см. assertPhotoSize) —
// клиент должен ресайзить/сжимать фото перед отправкой (item41), это последняя серверная
// гарантия, а не расчёт на добросовестность клиента.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

type MasterWithRelations = Prisma.MasterGetPayload<{
  include: typeof masterInclude;
}>;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMasterDto, salonId: string) {
    await this.assertCategoriesInSalon(dto.specializationCategoryIds, salonId);

    const master = await this.prisma.master.create({
      data: {
        salonId,
        name: dto.name,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        specializations: {
          create: dto.specializationCategoryIds.map((categoryId) => ({
            categoryId,
          })),
        },
      },
      include: masterInclude,
    });

    return this.toMasterDetail(master);
  }

  async findAll(user: AuthenticatedUser) {
    const masters = await this.prisma.master.findMany({
      where: this.scopeWhere(user),
      orderBy: { createdAt: 'desc' },
      include: masterInclude,
    });

    return masters.map((master) => this.toMasterDetail(master));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    // scopeWhere() can itself carry an `id` (MASTER scope) — merge via AND rather than
    // object-spread, which would let scopeWhere's `id` silently overwrite the requested one.
    const master = await this.prisma.master.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user)] },
      include: masterInclude,
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }

    return this.toMasterDetail(master);
  }

  async update(id: string, dto: UpdateMasterDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);

    if (dto.isActive === false) {
      await this.assertNoUpcomingBookings(id);
    }

    if (dto.specializationCategoryIds !== undefined) {
      await this.assertCategoriesInSalon(
        dto.specializationCategoryIds,
        salonId,
      );

      const [, , master] = await this.prisma.$transaction([
        this.prisma.masterSpecialization.deleteMany({
          where: { masterId: id },
        }),
        this.prisma.masterSpecialization.createMany({
          data: dto.specializationCategoryIds.map((categoryId) => ({
            masterId: id,
            categoryId,
          })),
        }),
        this.prisma.master.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          include: masterInclude,
        }),
      ]);

      return this.toMasterDetail(master);
    }

    const master = await this.prisma.master.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: masterInclude,
    });

    return this.toMasterDetail(master);
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

  async uploadPhoto(id: string, dto: UploadMasterPhotoDto, salonId: string) {
    await this.assertExistsInSalon(id, salonId);
    this.assertPhotoSize(dto.photo);

    const master = await this.prisma.master.update({
      where: { id },
      data: { photo: dto.photo },
      include: masterInclude,
    });

    return this.toMasterDetail(master);
  }

  async removePhoto(id: string, salonId: string): Promise<void> {
    await this.assertExistsInSalon(id, salonId);

    await this.prisma.master.update({
      where: { id },
      data: { photo: null },
    });
  }

  // Формат data URL уже проверен @Matches в UploadMasterPhotoDto — здесь только объём
  // декодированных байт.
  private assertPhotoSize(dataUrl: string): void {
    const base64Payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const byteLength = Buffer.from(base64Payload, 'base64').length;

    if (byteLength > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Photo must not exceed 2MB');
    }
  }

  private toMasterDetail(master: MasterWithRelations) {
    const { services, specializations, ...rest } = master;
    return {
      ...rest,
      services: services.map((link) => link.service),
      specializationCategoryIds: specializations.map((s) => s.categoryId),
    };
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

  // Деактивация не должна молча оставлять клиентов без мастера на подтверждённую запись —
  // сначала админ обязан отменить или перенести будущие записи на другого мастера.
  private async assertNoUpcomingBookings(masterId: string): Promise<void> {
    const upcomingBooking = await this.prisma.booking.findFirst({
      where: {
        masterId,
        startTime: { gte: new Date() },
        status: { in: [BookingStatus.CREATED, BookingStatus.CONFIRMED] },
      },
    });

    if (upcomingBooking) {
      throw new ConflictException(
        'Нельзя деактивировать мастера с активными записями — сначала отмените или перенесите их',
      );
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

  // Валидирует набор categoryId разом: дубликаты запрещены явной ошибкой (иначе они бы
  // тихо уронили createMany на composite PK master_specializations с P2002), а count()
  // должен совпасть с числом id — иначе среди них есть чужой салон или несуществующий id.
  private async assertCategoriesInSalon(
    categoryIds: string[],
    salonId: string,
  ): Promise<void> {
    const uniqueIds = new Set(categoryIds);
    if (uniqueIds.size !== categoryIds.length) {
      throw new BadRequestException(
        'specializationCategoryIds must not contain duplicates',
      );
    }

    const count = await this.prisma.serviceCategory.count({
      where: { salonId, id: { in: categoryIds } },
    });

    if (count !== categoryIds.length) {
      throw new BadRequestException('Invalid specializationCategoryIds');
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
