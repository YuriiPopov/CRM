import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NewsPost, NewsStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { UploadNewsImageDto } from './dto/upload-news-image.dto';

// Лимит — на декодированные байты, как у фото мастера (StaffService.assertPhotoSize); admin-app
// сжимает картинку до отправки, это серверная гарантия.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Клиенту не нужны salonId/status/служебные даты — только то, что показывает карточка новости
const clientNewsSelect = {
  id: true,
  category: true,
  title: true,
  body: true,
  imageUrl: true,
  publishedAt: true,
} as const;

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(salonId: string) {
    return this.prisma.newsPost.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateNewsDto, salonId: string) {
    const status = dto.status ?? NewsStatus.DRAFT;
    return this.prisma.newsPost.create({
      data: {
        salonId,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        status,
        publishedAt: status === NewsStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async update(id: string, dto: UpdateNewsDto, salonId: string) {
    const post = await this.findInSalon(id, salonId);

    return this.prisma.newsPost.update({
      where: { id },
      data: {
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.status !== undefined && { status: dto.status }),
        // publishedAt — момент ПЕРВОЙ публикации: повторная публикация после «Szkic» его не
        // сдвигает, иначе старая новость снова всплывала бы первой в ленте клиента
        ...(dto.status === NewsStatus.PUBLISHED &&
          post.publishedAt === null && { publishedAt: new Date() }),
      },
    });
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.findInSalon(id, salonId);
    await this.prisma.newsPost.delete({ where: { id } });
  }

  async uploadImage(id: string, dto: UploadNewsImageDto, salonId: string) {
    await this.findInSalon(id, salonId);
    this.assertImageSize(dto.image);

    return this.prisma.newsPost.update({
      where: { id },
      data: { imageUrl: dto.image },
    });
  }

  async removeImage(id: string, salonId: string): Promise<void> {
    await this.findInSalon(id, salonId);
    await this.prisma.newsPost.update({
      where: { id },
      data: { imageUrl: null },
    });
  }

  // Лента клиента: только опубликованные новости его салона, новые сверху
  findPublished(salonId: string) {
    return this.prisma.newsPost.findMany({
      where: { salonId, status: NewsStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: clientNewsSelect,
    });
  }

  private async findInSalon(id: string, salonId: string): Promise<NewsPost> {
    const post = await this.prisma.newsPost.findFirst({
      where: { id, salonId },
    });

    if (!post) {
      throw new NotFoundException('News post not found');
    }

    return post;
  }

  // Формат data URL уже проверен @Matches в UploadNewsImageDto — здесь только объём
  private assertImageSize(dataUrl: string): void {
    const base64Payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const byteLength = Buffer.from(base64Payload, 'base64').length;

    if (byteLength > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must not exceed 5MB');
    }
  }
}
