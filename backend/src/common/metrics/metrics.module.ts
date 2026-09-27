import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    // Кастомные счётчики и гистограммы
    makeCounterProvider({
      name: 'b4u_bookings_total',
      help: 'Total number of bookings created',
      labelNames: ['status', 'service_type'],
    }),
    makeHistogramProvider({
      name: 'b4u_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    }),
    makeCounterProvider({
      name: 'b4u_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    }),
    MetricsMiddleware,
  ],
  exports: [PrometheusModule],
})
export class MetricsModule implements NestModule {
  // Middleware на все маршруты — регистрируется здесь, рядом со своими зависимостями (метриками)
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
