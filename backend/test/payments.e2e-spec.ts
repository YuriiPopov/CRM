import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Booking,
  BookingSource,
  BookingStatus,
  Payment,
  Prisma,
  Role,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { PaymentsModule } from '../src/payments/payments.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

// CreatePaymentDto validates bookingId with @IsUUID() — needs a real UUID shape, unlike
// the freely-named booking/user ids used elsewhere in this file.
const BOOKING_COMPLETED_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_CONFIRMED_ID = '22222222-2222-4222-8222-222222222222';
const BOOKING_OTHER_MASTER_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ALREADY_PAID_ID = '44444444-4444-4444-8444-444444444444';
const BOOKING_OTHER_SALON_ID = '55555555-5555-4555-8555-555555555555';

interface PaymentWhere {
  id?: string;
  booking?: { salonId?: string; masterId?: string };
  paidAt?: { gte?: Date; lte?: Date };
  AND?: PaymentWhere[];
}

// Прогоняет реальные Payments-контроллер/сервис/guard'ы через HTTP поверх настоящего Auth-модуля
// (токен добывается через живой /auth/login), но с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private bookingsById = new Map<string, Booking>();
  private paymentsById = new Map<string, Payment>();
  private paymentsByBookingId = new Map<string, Payment>();
  private nextPaymentId = 1;

  user = {
    findUnique: ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<User | null> => {
      if (where.id)
        return Promise.resolve(this.usersById.get(where.id) ?? null);
      if (where.email)
        return Promise.resolve(this.usersByEmail.get(where.email) ?? null);
      return Promise.resolve(null);
    },
  };

  booking = {
    findFirst: ({
      where,
    }: {
      where: { id?: string; salonId?: string };
    }): Promise<Booking | null> => {
      const found = [...this.bookingsById.values()].find(
        (b) =>
          (!where.id || b.id === where.id) &&
          (!where.salonId || b.salonId === where.salonId),
      );
      return Promise.resolve(found ?? null);
    },
  };

  payment = {
    create: ({ data }: { data: Omit<Payment, 'id'> }): Promise<Payment> => {
      if (this.paymentsByBookingId.has(data.bookingId)) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: '6.19.3' },
        );
      }
      const payment: Payment = {
        id: `payment-${this.nextPaymentId++}`,
        ...data,
      };
      this.paymentsById.set(payment.id, payment);
      this.paymentsByBookingId.set(payment.bookingId, payment);
      return Promise.resolve(payment);
    },
    findMany: ({ where }: { where: PaymentWhere }): Promise<Payment[]> => {
      return Promise.resolve(
        [...this.paymentsById.values()].filter((p) => this.matches(p, where)),
      );
    },
    findFirst: ({
      where,
    }: {
      where: PaymentWhere;
    }): Promise<Payment | null> => {
      const found = [...this.paymentsById.values()].find((p) =>
        this.matches(p, where),
      );
      return Promise.resolve(found ?? null);
    },
    aggregate: ({
      where,
    }: {
      where: PaymentWhere;
    }): Promise<{
      _sum: { amount: number | null; discount: number | null };
      _count: number;
    }> => {
      const matched = [...this.paymentsById.values()].filter((p) =>
        this.matches(p, where),
      );
      if (matched.length === 0) {
        return Promise.resolve({
          _sum: { amount: null, discount: null },
          _count: 0,
        });
      }
      const sumAmount = matched.reduce((acc, p) => acc + Number(p.amount), 0);
      const sumDiscount = matched.reduce(
        (acc, p) => acc + Number(p.discount),
        0,
      );
      return Promise.resolve({
        _sum: { amount: sumAmount, discount: sumDiscount },
        _count: matched.length,
      });
    },
  };

  private matches(payment: Payment, where: PaymentWhere): boolean {
    if (where.id && payment.id !== where.id) return false;

    if (where.booking) {
      const booking = this.bookingsById.get(payment.bookingId);
      if (!booking) return false;
      if (where.booking.salonId && booking.salonId !== where.booking.salonId) {
        return false;
      }
      if (
        where.booking.masterId &&
        booking.masterId !== where.booking.masterId
      ) {
        return false;
      }
    }

    if (where.paidAt) {
      if (where.paidAt.gte && !(payment.paidAt! >= where.paidAt.gte)) {
        return false;
      }
      if (where.paidAt.lte && !(payment.paidAt! <= where.paidAt.lte)) {
        return false;
      }
    }

    if (where.AND && !where.AND.every((cond) => this.matches(payment, cond))) {
      return false;
    }

    return true;
  }

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedBooking(booking: Booking) {
    this.bookingsById.set(booking.id, booking);
  }

  seedPayment(payment: Payment) {
    this.paymentsById.set(payment.id, payment);
    this.paymentsByBookingId.set(payment.bookingId, payment);
  }
}

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

  const adminPassword = 'AdminPass1';
  const master1Password = 'Master1Pass1';
  const master2Password = 'Master2Pass1';

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    prisma = new FakePrismaService();

    prisma.seedUser({
      id: 'admin-1',
      salonId: 'salon-1',
      email: 'admin@b4u.local',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: Role.ADMIN,
      masterId: null,
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedUser({
      id: 'master-user-1',
      salonId: 'salon-1',
      email: 'master1@b4u.local',
      passwordHash: await bcrypt.hash(master1Password, 4),
      role: Role.MASTER,
      masterId: 'master-rec-1',
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedUser({
      id: 'master-user-2',
      salonId: 'salon-1',
      email: 'master2@b4u.local',
      passwordHash: await bcrypt.hash(master2Password, 4),
      role: Role.MASTER,
      masterId: 'master-rec-2',
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedBooking({
      id: BOOKING_COMPLETED_ID,
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-1',
      serviceId: 'service-a',
      startTime: new Date('2026-01-10T10:00:00.000Z'),
      endTime: new Date('2026-01-10T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });
    prisma.seedBooking({
      id: BOOKING_CONFIRMED_ID,
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-1',
      serviceId: 'service-a',
      startTime: new Date('2026-01-11T10:00:00.000Z'),
      endTime: new Date('2026-01-11T11:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });
    prisma.seedBooking({
      id: BOOKING_OTHER_MASTER_ID,
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-2',
      serviceId: 'service-a',
      startTime: new Date('2026-01-12T10:00:00.000Z'),
      endTime: new Date('2026-01-12T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });
    prisma.seedBooking({
      id: BOOKING_ALREADY_PAID_ID,
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-1',
      serviceId: 'service-a',
      startTime: new Date('2026-01-13T10:00:00.000Z'),
      endTime: new Date('2026-01-13T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });
    prisma.seedPayment({
      id: 'payment-existing',
      bookingId: BOOKING_ALREADY_PAID_ID,
      amount: 100 as unknown as Payment['amount'],
      discount: 0 as unknown as Payment['discount'],
      method: 'cash',
      status: 'paid',
      paidAt: new Date('2026-01-13T12:00:00.000Z'),
    });
    prisma.seedBooking({
      id: BOOKING_OTHER_SALON_ID,
      salonId: 'salon-2',
      clientId: 'client-x',
      masterId: 'master-other-salon',
      serviceId: 'service-x',
      startTime: new Date('2026-01-14T10:00:00.000Z'),
      endTime: new Date('2026-01-14T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        PaymentsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const body = response.body as { accessToken: string };
    return body.accessToken;
  }

  describe('POST /payments', () => {
    it('allows ADMIN to record a payment for a completed booking', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_COMPLETED_ID,
          amount: 200,
          discount: 20,
          method: 'card',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        bookingId: BOOKING_COMPLETED_ID,
        amount: 200,
        discount: 20,
        method: 'card',
        status: 'paid',
      });
      expect(response.body).toHaveProperty('paidAt');
    });

    it('rejects payment for a confirmed (not completed) booking', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_CONFIRMED_ID, amount: 100, method: 'cash' })
        .expect(409);
    });

    it('rejects a duplicate payment for an already-paid booking', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_ALREADY_PAID_ID,
          amount: 50,
          method: 'cash',
        })
        .expect(409);
    });

    it('rejects a discount larger than the amount', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_COMPLETED_ID,
          amount: 50,
          discount: 60,
          method: 'cash',
        })
        .expect(400);
    });

    it('rejects a booking from another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_OTHER_SALON_ID,
          amount: 100,
          method: 'cash',
        })
        .expect(404);
    });

    it('forbids MASTER from recording payments', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ bookingId: BOOKING_COMPLETED_ID, amount: 100, method: 'cash' })
        .expect(403);
    });
  });

  describe('GET /payments and /payments/:id', () => {
    it('gives ADMIN full financial detail, scoped to their own salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const list = await request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = list.body as Array<{ id: string; amount?: number }>;
      expect(body.map((p) => p.id)).toEqual(['payment-existing']);
      expect(body[0]).toHaveProperty('amount');
      expect(body[0]).toHaveProperty('method');

      const detail = await request(app.getHttpServer())
        .get('/payments/payment-existing')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(detail.body).toMatchObject({ amount: 100, method: 'cash' });
    });

    it('gives MASTER only the fact of payment for their own booking, no financial detail', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/payments/payment-existing')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: 'payment-existing',
        bookingId: BOOKING_ALREADY_PAID_ID,
        paidAt: '2026-01-13T12:00:00.000Z',
      });
      expect(response.body).not.toHaveProperty('amount');
      expect(response.body).not.toHaveProperty('discount');
      expect(response.body).not.toHaveProperty('method');
    });

    it('returns 404 when MASTER requests a payment for another master booking', async () => {
      const token = await loginAs('master2@b4u.local', master2Password);

      await request(app.getHttpServer())
        .get('/payments/payment-existing')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /payments/report/revenue', () => {
    beforeEach(async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);
      await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: BOOKING_COMPLETED_ID,
          amount: 300,
          discount: 50,
          method: 'card',
        })
        .expect(201);
    });

    it('reports gross/discount/net revenue across the salon for ADMIN', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/payments/report/revenue')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // payment-existing (100/0) + the newly created one (300/50)
      expect(response.body).toMatchObject({
        paymentsCount: 2,
        grossAmount: 400,
        totalDiscount: 50,
        netRevenue: 350,
      });
    });

    it('forbids MASTER from viewing the revenue report', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/payments/report/revenue')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects an inverted date range', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .get('/payments/report/revenue?from=2026-02-01&to=2026-01-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    // Regression: a payment recorded just now (paidAt = real "now", like the end of the
    // create-booking -> COMPLETED -> POST /payments flow) must show up under the "Today"/
    // "This month" presets, which query with bare from=to=<today> dates. Before the fix,
    // a bare "to" was compared as that day's midnight (lte 00:00:00.000Z), which excluded
    // every payment made later the same day.
    it('includes a payment made moments ago when queried with bare "Today" dates', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);
      const today = new Date().toISOString().slice(0, 10);

      const response = await request(app.getHttpServer())
        .get(`/payments/report/revenue?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Only the payment created in this describe's beforeEach (paidAt = now); the
      // 'payment-existing' fixture is dated 2026-01-13 and must stay excluded.
      expect(response.body).toMatchObject({
        paymentsCount: 1,
        grossAmount: 300,
        totalDiscount: 50,
        netRevenue: 250,
      });
    });
  });
});
