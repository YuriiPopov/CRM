import { UnprocessableEntityException } from '@nestjs/common';

// Машинные коды 422 — по ним admin-app показывает польское сообщение (message — для логов и других клиентов)
export type ArticleErrorCode =
  | 'ARTICLE_TOO_LARGE'
  | 'ARTICLE_RESULT_TOO_LARGE'
  | 'ARTICLE_INVALID_HTML'
  | 'ARTICLE_IMAGE_INVALID';

export class ArticleException extends UnprocessableEntityException {
  constructor(code: ArticleErrorCode, message: string) {
    super({ statusCode: 422, error: 'Unprocessable Entity', code, message });
  }
}
