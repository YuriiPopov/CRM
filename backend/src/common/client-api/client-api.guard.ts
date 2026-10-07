import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

// Версия клиентского API (item78, часть A): каждый клиент (веб-CRM, admin-app, master-app,
// client-app) шлёт её в заголовке X-Client-Api. Когда обязательный минимум MIN_CLIENT_API
// поднимается выше версии клиента — он получает 426 и показывает «обновите приложение».
// Так старые сборки не работают с несовместимым форматом данных (переход на настоящий UTC, часть B).
export const CLIENT_API_HEADER = 'x-client-api';
export const CLIENT_UPDATE_REQUIRED = 'CLIENT_UPDATE_REQUIRED';

// 0 (по умолчанию) — проверка выключена. Читается из env на каждый запрос, чтобы порог
// можно было менять без пересборки и подменять в тестах.
export function minClientApi(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MIN_CLIENT_API?.trim();
  if (!raw) return 0;
  return Number(raw);
}

/** Отказывается стартовать с мусором в MIN_CLIENT_API: иначе проверка молча отключилась бы. */
export function assertMinClientApi(env: NodeJS.ProcessEnv): void {
  const value = minClientApi(env);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Invalid MIN_CLIENT_API "${env.MIN_CLIENT_API}": expected a non-negative integer`,
    );
  }
}

// Маршруты без проверки: мониторинг (docker/Prometheus не шлют заголовок) и публичные
// эндпоинты для сайта. CORS preflight (OPTIONS) заголовков клиента не несёт.
const EXEMPT_PATHS = [
  /^\/$/,
  /^\/health\/?$/,
  /^\/metrics\/?$/,
  /^\/public(\/|$)/,
];

@Injectable()
export class ClientApiGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const min = minClientApi();
    if (min <= 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'OPTIONS') return true;
    const path = req.path ?? req.url.split('?')[0];
    if (EXEMPT_PATHS.some((pattern) => pattern.test(path))) return true;

    const header = req.headers[CLIENT_API_HEADER];
    const version = Number(Array.isArray(header) ? header[0] : header);
    // Нет заголовка или он не число — как версия 0
    if (Number.isInteger(version) && version >= min) return true;

    throw new HttpException(
      {
        statusCode: 426,
        code: CLIENT_UPDATE_REQUIRED,
        message:
          'Требуется обновление приложения. Установите новую версию или обновите страницу.',
      },
      426,
    );
  }
}
