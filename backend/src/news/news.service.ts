import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NewsPost, NewsStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleException } from './article/article-errors';
import { sanitizeArticleHtml } from './article/article-sanitizer';
import {
  ARTICLE_RESULT_MAX_BYTES,
  ARTICLE_SOURCE_MAX_BYTES,
} from './dto/article-limits';
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

// Админский вид новости: HTML статьи (до 4 МБ) в ответ не попадает — только признак hasArticle
type AdminNewsPost = Omit<NewsPost, 'contentHtml'> & { hasArticle: boolean };

function toAdminView(post: NewsPost): AdminNewsPost {
  const { contentHtml, ...rest } = post;
  return { ...rest, hasArticle: contentHtml !== null };
}

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(salonId: string): Promise<AdminNewsPost[]> {
    const posts = await this.prisma.newsPost.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
      omit: { contentHtml: true },
    });
    const withArticle = await this.idsWithArticle(salonId);
    return posts.map((post) => ({
      ...post,
      hasArticle: withArticle.has(post.id),
    }));
  }

  // Единственный админский маршрут, отдающий contentHtml (форма редактирования и «Podgląd»)
  async findOne(
    id: string,
    salonId: string,
  ): Promise<NewsPost & { hasArticle: boolean }> {
    const post = await this.findInSalon(id, salonId);
    return { ...post, hasArticle: post.contentHtml !== null };
  }

  async create(dto: CreateNewsDto, salonId: string): Promise<AdminNewsPost> {
    const status = dto.status ?? NewsStatus.DRAFT;
    const contentHtml = await this.processArticle(dto.contentHtml);
    const post = await this.prisma.newsPost.create({
      data: {
        salonId,
        category: dto.category,
        title: dto.title,
        body: dto.body,
        status,
        publishedAt: status === NewsStatus.PUBLISHED ? new Date() : null,
        ...(contentHtml !== undefined && { contentHtml }),
      },
    });
    return toAdminView(post);
  }

  async update(
    id: string,
    dto: UpdateNewsDto,
    salonId: string,
  ): Promise<AdminNewsPost> {
    const post = await this.findInSalon(id, salonId);
    // После findInSalon: чужая/несуществующая новость — 404, а не 422 за чужой файл
    const contentHtml = await this.processArticle(dto.contentHtml);

    const updated = await this.prisma.newsPost.update({
      where: { id },
      data: {
        ...(contentHtml !== undefined && { contentHtml }),
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
    return toAdminView(updated);
  }

  async remove(id: string, salonId: string): Promise<void> {
    await this.findInSalon(id, salonId);
    await this.prisma.newsPost.delete({ where: { id } });
  }

  async uploadImage(id: string, dto: UploadNewsImageDto, salonId: string) {
    await this.findInSalon(id, salonId);
    this.assertImageSize(dto.image);

    const post = await this.prisma.newsPost.update({
      where: { id },
      data: { imageUrl: dto.image },
    });
    return toAdminView(post);
  }

  async removeImage(id: string, salonId: string): Promise<void> {
    await this.findInSalon(id, salonId);
    await this.prisma.newsPost.update({
      where: { id },
      data: { imageUrl: null },
    });
  }

  // Лента клиента: только опубликованные новости его салона, новые сверху. HTML статьи не отдаём —
  // только hasArticle; сам текст — GET /client/news/:id.
  async findPublished(salonId: string) {
    const posts = await this.prisma.newsPost.findMany({
      where: { salonId, status: NewsStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: clientNewsSelect,
    });
    const withArticle = await this.idsWithArticle(salonId);
    return posts.map((post) => ({
      ...post,
      hasArticle: withArticle.has(post.id),
    }));
  }

  // Статья опубликованной новости своего салона; черновик и чужой салон — 404 (как несуществующая)
  async findPublishedArticle(id: string, salonId: string) {
    const post = await this.prisma.newsPost.findFirst({
      where: { id, salonId, status: NewsStatus.PUBLISHED },
      select: { id: true, title: true, contentHtml: true },
    });
    if (!post) {
      throw new NotFoundException('News post not found');
    }
    return post;
  }

  // Какие новости салона имеют статью — без передачи самого HTML из БД
  private async idsWithArticle(salonId: string): Promise<Set<string>> {
    const rows = await this.prisma.newsPost.findMany({
      where: { salonId, contentHtml: { not: null } },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  // undefined — поле не прислали (не менять); null — удалить статью; строка — санитизированный HTML
  private async processArticle(
    raw: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (raw === undefined) return undefined;
    if (raw === null || raw.trim() === '') return null;
    if (Buffer.byteLength(raw, 'utf8') > ARTICLE_SOURCE_MAX_BYTES) {
      throw new ArticleException(
        'ARTICLE_TOO_LARGE',
        'Article file must not exceed 12MB',
      );
    }
    const html = await sanitizeArticleHtml(raw);
    if (Buffer.byteLength(html, 'utf8') > ARTICLE_RESULT_MAX_BYTES) {
      throw new ArticleException(
        'ARTICLE_RESULT_TOO_LARGE',
        'Article is larger than 4MB after processing; reduce the number or size of images',
      );
    }
    return html;
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
