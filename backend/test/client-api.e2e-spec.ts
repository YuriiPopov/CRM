import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ClientApiGuard } from '../src/common/client-api/client-api.guard';

@Controller()
class ProbeController {
  @Get('bookings')
  protectedRoute() {
    return { ok: true };
  }

  @Get('public/booking/slots')
  publicRoute() {
    return { ok: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

// item78, часть A: порог MIN_CLIENT_API через настоящий HTTP-стек с глобальным guard'ом.
describe('Client API version (e2e)', () => {
  let app: INestApplication<App>;
  const original = process.env.MIN_CLIENT_API;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [AppController, ProbeController],
      providers: [AppService, { provide: APP_GUARD, useClass: ClientApiGuard }],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (original === undefined) delete process.env.MIN_CLIENT_API;
    else process.env.MIN_CLIENT_API = original;
  });

  it('passes a request without the header when the threshold is 0', async () => {
    process.env.MIN_CLIENT_API = '0';
    await request(app.getHttpServer()).get('/bookings').expect(200);
  });

  it('answers 426 CLIENT_UPDATE_REQUIRED at threshold 2 without the header', async () => {
    process.env.MIN_CLIENT_API = '2';
    const response = await request(app.getHttpServer())
      .get('/bookings')
      .expect(426);
    expect(response.body).toMatchObject({
      statusCode: 426,
      code: 'CLIENT_UPDATE_REQUIRED',
    });
  });

  it('answers 426 for version 1 and passes version 2 at threshold 2', async () => {
    process.env.MIN_CLIENT_API = '2';
    await request(app.getHttpServer())
      .get('/bookings')
      .set('X-Client-Api', '1')
      .expect(426);
    await request(app.getHttpServer())
      .get('/bookings')
      .set('X-Client-Api', '2')
      .expect(200);
  });

  it('keeps /, /health and /public/* open at threshold 2', async () => {
    process.env.MIN_CLIENT_API = '2';
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/public/booking/slots').expect(200);
  });
});
