import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadServicePhotoDto } from './dto/upload-service-photo.dto';

export const MAX_SERVICE_PHOTOS = 5;
// Лимит — на декодированные байты; веб-CRM и admin-app сжимают картинку до отправки,
// это серверная гарантия (item84).
export const MAX_SERVICE_PHOTO_BYTES = 1024 * 1024;

// Временный сдвиг позиций при перестановке — уникальный индекс (serviceId, position) не даёт
// поменять две строки местами «напрямую»
const REORDER_TEMP_OFFSET = 100;

export type ServicePhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

// Тип определяется по сигнатуре файла, а не по расширению или объявленному mime
export function detectImageType(bytes: Buffer): ServicePhotoMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

@Injectable()
export class ServicePhotosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(serviceId: string, salonId: string) {
    await this.assertServiceInSalon(serviceId, salonId);
    return this.prisma.servicePhoto.findMany({
      where: { serviceId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, image: true },
    });
  }

  async add(serviceId: string, dto: UploadServicePhotoDto, salonId: string) {
    await this.assertServiceInSalon(serviceId, salonId);
    const image = this.parseImage(dto.image);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const count = await tx.servicePhoto.count({ where: { serviceId } });
        if (count >= MAX_SERVICE_PHOTOS) {
          throw new BadRequestException(
            `A service can have at most ${MAX_SERVICE_PHOTOS} photos`,
          );
        }
        return tx.servicePhoto.create({
          data: { serviceId, salonId, position: count, image },
          select: { id: true, position: true, image: true },
        });
      });
    } catch (error) {
      // Параллельный POST занял ту же позицию — уникальный индекс не даёт превысить лимит
      if (isUniqueViolation(error)) {
        throw new ConflictException('Photos were changed concurrently, retry');
      }
      throw error;
    }
  }

  async reorder(serviceId: string, photoIds: unknown, salonId: string) {
    await this.assertServiceInSalon(serviceId, salonId);

    if (
      !Array.isArray(photoIds) ||
      !photoIds.every((id): id is string => typeof id === 'string')
    ) {
      throw new BadRequestException('Body must be an array of photo ids');
    }
    const ids: string[] = photoIds;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.servicePhoto.findMany({
        where: { serviceId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((p) => p.id));
      if (
        ids.length !== existing.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => existingIds.has(id))
      ) {
        throw new BadRequestException(
          'Order must contain each photo of the service exactly once',
        );
      }

      for (const [position, id] of ids.entries()) {
        await tx.servicePhoto.update({
          where: { id },
          data: { position: position + REORDER_TEMP_OFFSET },
        });
      }
      for (const [position, id] of ids.entries()) {
        await tx.servicePhoto.update({ where: { id }, data: { position } });
      }
    });

    return this.list(serviceId, salonId);
  }

  async remove(serviceId: string, photoId: string, salonId: string) {
    await this.assertServiceInSalon(serviceId, salonId);

    await this.prisma.$transaction(async (tx) => {
      const photo = await tx.servicePhoto.findFirst({
        where: { id: photoId, serviceId },
        select: { id: true },
      });
      if (!photo) {
        throw new NotFoundException('Photo not found');
      }
      await tx.servicePhoto.delete({ where: { id: photoId } });

      // Позиции остаются без дыр (0 — обложка): сдвигаем хвост вверх по порядку
      const rest = await tx.servicePhoto.findMany({
        where: { serviceId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      for (const [position, p] of rest.entries()) {
        if (p.position !== position) {
          await tx.servicePhoto.update({
            where: { id: p.id },
            data: { position },
          });
        }
      }
    });
  }

  // Клиентское чтение (только салон клиента): id и порядок, без base64 — картинки тянутся по одной
  async listForClient(serviceId: string, salonId: string) {
    await this.assertServiceInSalon(serviceId, salonId);
    return this.prisma.servicePhoto.findMany({
      where: { serviceId, salonId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
  }

  // Бинарное содержимое одного фото для превью/кэша приложения
  async getBinaryForClient(photoId: string, salonId: string) {
    const photo = await this.prisma.servicePhoto.findFirst({
      where: { id: photoId, salonId },
      select: { image: true },
    });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    const bytes = Buffer.from(
      photo.image.slice(photo.image.indexOf(',') + 1),
      'base64',
    );
    return {
      bytes,
      mime: detectImageType(bytes) ?? 'application/octet-stream',
    };
  }

  // Проверка формата и размера; возвращает нормализованный data URL с mime по сигнатуре
  private parseImage(raw: string): string {
    const base64 = raw.slice(raw.indexOf(',') + 1).replace(/\s/g, '');
    const bytes = Buffer.from(base64, 'base64');

    if (bytes.length === 0) {
      throw new BadRequestException('Image is empty');
    }
    if (bytes.length > MAX_SERVICE_PHOTO_BYTES) {
      throw new BadRequestException('Image must not exceed 1MB');
    }
    const mime = detectImageType(bytes);
    if (!mime) {
      throw new BadRequestException(
        'Unsupported image format: only JPEG, PNG and WebP are allowed',
      );
    }
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }

  private async assertServiceInSalon(
    serviceId: string,
    salonId: string,
  ): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
