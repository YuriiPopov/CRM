import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';

// Запросы без совпавшего маршрута (404) — одной меткой, а не сырым путём: иначе каждый
// случайный URL от сканеров заводил бы новый временной ряд в Prometheus.
export const UNMATCHED_ROUTE = 'unmatched';

// Middleware, а не interceptor: interceptor выполняется после guard'ов и видит только успешные
// ответы — 401 от JwtAuthGuard, 429 от ThrottlerGuard, 404 и исключения из обработчиков в метрики
// не попадали бы. Событие 'finish' ответа срабатывает для любого исхода запроса.
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric('b4u_http_requests_total')
    private readonly counter: Counter<string>,
    @InjectMetric('b4u_http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      // req.route выставляется Express'ом при совпадении маршрута — шаблон пути (":id"), а не
      // конкретный URL, чтобы не плодить кардинальность меток.
      const route = req.route as { path?: string } | undefined;
      const labels = {
        method: req.method,
        path: route?.path ?? UNMATCHED_ROUTE,
        status_code: String(res.statusCode),
      };
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      this.counter.inc(labels);
      this.histogram.observe(labels, durationSec);
    });

    next();
  }
}
