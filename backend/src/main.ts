import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { assertProductionConfig } from './common/config/assert-production-config';
import { loggerConfig } from './common/logger/logger.module';
import { assertSalonTimezone } from './common/time/salon-time';

async function bootstrap() {
  // bodyParser: false — регистрируем json/urlencoded вручную ниже с увеличенным лимитом;
  // дефолтный лимит express (100kb) слишком мал для фото мастера в base64 (до ~2MB после
  // декодирования, ~2.7MB в base64 + JSON-обвязка, см. item41) и картинки новости (до 5MB
  // после декодирования, ~6.7MB в base64, item75).
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: loggerConfig,
  });

  // После create: ConfigModule уже загрузил .env в process.env, а сервер ещё не слушает порт
  assertProductionConfig(process.env);
  assertSalonTimezone(process.env);

  // Заменяем встроенный логгер NestJS на Winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
