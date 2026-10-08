import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';
import { NEWS_JSON_BODY_LIMIT } from '../news/dto/article-limits';

// POST /news и PATCH /news/:id — тело с HTML статьи (item89); /news/:id/image сюда не попадает
const NEWS_ARTICLE_ROUTE = /^\/news(\/[0-9a-f-]{36})?\/?$/i;

// Нужно приложение создано с bodyParser: false. Лимит JSON поднят только для маршрутов статьи
// новости; для остальных — прежние 8 МБ (фото мастера, картинка новости). Парсер статьи стоит
// первым: express пропускает уже разобранное тело, поэтому общий парсер на него не влияет.
export function registerBodyParsers(app: INestApplication): void {
  const articleParser = json({ limit: NEWS_JSON_BODY_LIMIT });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isArticleWrite =
      (req.method === 'POST' || req.method === 'PATCH') &&
      NEWS_ARTICLE_ROUTE.test(req.path);
    if (isArticleWrite) {
      articleParser(req, res, next);
    } else {
      next();
    }
  });
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
}
