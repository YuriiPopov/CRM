import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Booking,
  BookingSource,
  BookingStatus,
  Client,
  Master,
  Notification,
  NotificationStatus,
  NotificationType,
  Role,
  Service,
  ServiceCategory,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { BookingsModule } from '../src/bookings/bookings.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

// CreateBookingDto validates clientId/masterId/serviceId with @IsUUID(), unlike path params —
// these need to be UUID-shaped, unlike the freely-named booking/user ids used elsewhere in this file.
const CLIENT_A_ID = '11111111-1111-4111-8111-111111111111';
const MASTER_1_ID = '22222222-2222-4222-8222-222222222222';
const MASTER_2_ID = '33333333-3333-4333-8333-333333333333';
const SERVICE_A_ID = '44444444-4444-4444-8444-444444444444';

interface BookingWhere {
  id?: string | { not?: string };
  salonId?: string;
  masterId?: string;
  status?: BookingStatus | { notIn?: BookingStatus[] };
  startTime?: { lt?: Date };
  endTime?: { gt?: Date };
  AND?: BookingWhere[];
}

// Прогоняет реальные Bookings-контроллер/сервис/guard'ы через HTTP поверх настоящего Auth-модуля
// (токен добывается через живой /auth/login), но с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private clientsById = new Map<string, Client>();
  private mastersById = new Map<string, Master>();
  private servicesById = new Map<string, Service>();
  private bookingsById = new Map<string, Booking>();
  private notificationsById = new Map<string, Notification>();
  private nextBookingId = 1;
  private nextNotificationId = 1;

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

  client = {
    findFirst: ({
      where,
    }: {
      where: { id?: string; salonId?: string };
    }): Promise<Client | null> => {
      const found = [...this.clientsById.values()].find(
        (c) =>
          (!where.id || c.id === where.id) &&
          (!where.salonId || c.salonId === where.salonId),
      );
      return Promise.resolve(found ?? null);
    },
  };

  master = {
    findFirst: ({
      where,
    }: {
      where: { id?: string; salonId?: string };
    }): Promise<Master | null> => {
      const found = [...this.mastersById.values()].find(
        (m) =>
          (!where.id || m.id === where.id) &&
          (!where.salonId || m.salonId === where.salonId),
      );
      return Promise.resolve(found ?? null);
    },
  };

  service = {
    findFirst: ({
      where,
    }: {
      where: { id?: string; salonId?: string };
    }): Promise<Service | null> => {
      const found = [...this.servicesById.values()].find(
        (s) =>
          (!where.id || s.id === where.id) &&
          (!where.salonId || s.salonId === where.salonId),
      );
      return Promise.resolve(found ?? null);
    },
  };

  booking = {
    create: ({
      data,
    }: {
      data: Omit<Booking, 'id' | 'createdAt' | 'status' | 'source'>;
    }): Promise<Booking> => {
      const booking: Booking = {
        id: `booking-${this.nextBookingId++}`,
        createdAt: new Date(),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        ...data,
      };
      this.bookingsById.set(booking.id, booking);
      return Promise.resolve(booking);
    },
    findMany: ({ where }: { where: BookingWhere }): Promise<Booking[]> => {
      return Promise.resolve(
        [...this.bookingsById.values()].filter((b) => this.matches(b, where)),
      );
    },
    findFirst: ({
      where,
    }: {
      where: BookingWhere;
    }): Promise<Booking | null> => {
      const found = [...this.bookingsById.values()].find((b) =>
        this.matches(b, where),
      );
      return Promise.resolve(found ?? null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Booking>;
    }): Promise<Booking> => {
      const existing = this.bookingsById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.bookingsById.set(where.id, updated);
      return Promise.resolve(updated);
    },
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<(Booking & { client: Client; service: Service }) | null> => {
      const booking = this.bookingsById.get(where.id);
      if (!booking) return Promise.resolve(null);
      const client = this.clientsById.get(booking.clientId)!;
      const service = this.servicesById.get(booking.serviceId)!;
      return Promise.resolve({ ...booking, client, service });
    },
  };

  notification = {
    create: ({
      data,
    }: {
      data: Omit<Notification, 'id' | 'createdAt' | 'sentAt'>;
    }): Promise<Notification> => {
      const notification: Notification = {
        id: `notification-${this.nextNotificationId++}`,
        createdAt: new Date(),
        sentAt: null,
        ...data,
      };
      this.notificationsById.set(notification.id, notification);
      return Promise.resolve(notification);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Notification>;
    }): Promise<Notification> => {
      const existing = this.notificationsById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.notificationsById.set(where.id, updated);
      return Promise.resolve(updated);
    },
  };

  getNotificationsForBooking(bookingId: string): Notification[] {
    return [...this.notificationsById.values()].filter(
      (n) => n.bookingId === bookingId,
    );
  }

  private matches(booking: Booking, where: BookingWhere): boolean {
    if (where.id !== undefined) {
      if (typeof where.id === 'string') {
        if (booking.id !== where.id) return false;
      } else if (where.id.not !== undefined && booking.id === where.id.not) {
        return false;
      }
    }
    if (where.salonId && booking.salonId !== where.salonId) return false;
    if (where.masterId && booking.masterId !== where.masterId) return false;
    if (where.status !== undefined) {
      if (typeof where.status === 'string') {
        if (booking.status !== where.status) return false;
      } else if (
        where.status.notIn !== undefined &&
        where.status.notIn.includes(booking.status)
      ) {
        return false;
      }
    }
    if (where.startTime?.lt && !(booking.startTime < where.startTime.lt)) {
      return false;
    }
    if (where.endTime?.gt && !(booking.endTime > where.endTime.gt)) {
      return false;
    }
    if (where.AND && !where.AND.every((cond) => this.matches(booking, cond))) {
      return false;
    }
    return true;
  }

  seedUser(user: User) {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  seedClient(client: Client) {
    this.clientsById.set(client.id, client);
  }

  seedMaster(master: Master) {
    this.mastersById.set(master.id, master);
  }

  seedService(service: Service) {
    this.servicesById.set(service.id, service);
  }

  seedBooking(booking: Booking) {
    this.bookingsById.set(booking.id, booking);
  }
}

describe('Bookings (e2e)', () => {
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
      masterId: MASTER_1_ID,
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedUser({
      id: 'master-user-2',
      salonId: 'salon-1',
      email: 'master2@b4u.local',
      passwordHash: await bcrypt.hash(master2Password, 4),
      role: Role.MASTER,
      masterId: MASTER_2_ID,
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedClient({
      id: CLIENT_A_ID,
      salonId: 'salon-1',
      name: 'Client A',
      phone: '+48000000001',
      email: 'client-a@example.com',
      notes: null,
      tags: [],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });

    prisma.seedMaster({
      id: MASTER_1_ID,
      salonId: 'salon-1',
      name: 'Anna',
      specialization: ServiceCategory.SPA,
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedMaster({
      id: MASTER_2_ID,
      salonId: 'salon-1',
      name: 'Boris',
      specialization: ServiceCategory.MASSAGE,
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedService({
      id: SERVICE_A_ID,
      salonId: 'salon-1',
      name: 'Massage',
      category: ServiceCategory.MASSAGE,
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        BookingsModule,
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

  describe('POST /bookings', () => {
    it('allows ADMIN to create a booking for a chosen master', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          masterId: MASTER_1_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:00:00.000Z',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        salonId: 'salon-1',
        masterId: MASTER_1_ID,
        status: BookingStatus.CREATED,
        startTime: '2026-03-10T10:00:00.000Z',
        endTime: '2026-03-10T11:00:00.000Z',
      });

      const bookingId = (response.body as { id: string }).id;
      const notifications = prisma.getNotificationsForBooking(bookingId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: NotificationType.BOOKING_CONFIRMATION,
        status: NotificationStatus.SENT,
      });
    });

    it('rejects ADMIN creation without a masterId', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:00:00.000Z',
        })
        .expect(400);
    });

    it('lets MASTER create a booking for themselves', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:00:00.000Z',
        })
        .expect(201);

      expect(response.body).toMatchObject({ masterId: MASTER_1_ID });
    });

    it('forbids MASTER from creating a booking for another master', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          masterId: MASTER_2_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:00:00.000Z',
        })
        .expect(403);
    });

    it('rejects an overlapping booking for the same master', async () => {
      prisma.seedBooking({
        id: 'existing-booking',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T10:00:00.000Z'),
        endTime: new Date('2026-03-10T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          masterId: MASTER_1_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:30:00.000Z',
        })
        .expect(409);
    });

    it('allows booking over a cancelled slot for the same master', async () => {
      prisma.seedBooking({
        id: 'cancelled-booking',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T10:00:00.000Z'),
        endTime: new Date('2026-03-10T11:00:00.000Z'),
        status: BookingStatus.CANCELLED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId: CLIENT_A_ID,
          masterId: MASTER_1_ID,
          serviceId: SERVICE_A_ID,
          startTime: '2026-03-10T10:30:00.000Z',
        })
        .expect(201);
    });
  });

  describe('GET /bookings', () => {
    beforeEach(() => {
      prisma.seedBooking({
        id: 'booking-master-1',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T10:00:00.000Z'),
        endTime: new Date('2026-03-10T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
      prisma.seedBooking({
        id: 'booking-master-2',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_2_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-11T10:00:00.000Z'),
        endTime: new Date('2026-03-11T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
    });

    it('lets ADMIN see every booking in their own salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Booking[];
      expect(body.map((b) => b.id).sort()).toEqual([
        'booking-master-1',
        'booking-master-2',
      ]);
    });

    it('lets MASTER see only their own bookings', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Booking[];
      expect(body.map((b) => b.id)).toEqual(['booking-master-1']);
    });
  });

  describe('GET /bookings/:id', () => {
    beforeEach(() => {
      prisma.seedBooking({
        id: 'booking-master-2',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_2_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-11T10:00:00.000Z'),
        endTime: new Date('2026-03-11T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
    });

    it('returns 404 when a MASTER requests another master booking', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/bookings/booking-master-2')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /bookings/:id/reschedule', () => {
    beforeEach(() => {
      prisma.seedBooking({
        id: 'booking-1',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T10:00:00.000Z'),
        endTime: new Date('2026-03-10T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
    });

    it('forbids MASTER from rescheduling', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/reschedule')
        .set('Authorization', `Bearer ${token}`)
        .send({ startTime: '2026-03-10T14:00:00.000Z' })
        .expect(403);
    });

    it('allows ADMIN to reschedule and recompute endTime from the service duration', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/bookings/booking-1/reschedule')
        .set('Authorization', `Bearer ${token}`)
        .send({ startTime: '2026-03-10T14:00:00.000Z' })
        .expect(200);

      expect(response.body).toMatchObject({
        startTime: '2026-03-10T14:00:00.000Z',
        endTime: '2026-03-10T15:00:00.000Z',
      });

      const notifications = prisma.getNotificationsForBooking('booking-1');
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: NotificationType.BOOKING_RESCHEDULED,
        status: NotificationStatus.SENT,
      });
    });

    it('rejects rescheduling into an overlap with another active booking', async () => {
      prisma.seedBooking({
        id: 'booking-2',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T14:00:00.000Z'),
        endTime: new Date('2026-03-10T15:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/reschedule')
        .set('Authorization', `Bearer ${token}`)
        .send({ startTime: '2026-03-10T14:30:00.000Z' })
        .expect(409);
    });

    it('rejects rescheduling a cancelled booking', async () => {
      prisma.seedBooking({
        id: 'cancelled-1',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-12T10:00:00.000Z'),
        endTime: new Date('2026-03-12T11:00:00.000Z'),
        status: BookingStatus.CANCELLED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .patch('/bookings/cancelled-1/reschedule')
        .set('Authorization', `Bearer ${token}`)
        .send({ startTime: '2026-03-12T14:00:00.000Z' })
        .expect(409);
    });
  });

  describe('PATCH /bookings/:id/status', () => {
    beforeEach(() => {
      prisma.seedBooking({
        id: 'booking-1',
        salonId: 'salon-1',
        clientId: CLIENT_A_ID,
        masterId: MASTER_1_ID,
        serviceId: SERVICE_A_ID,
        startTime: new Date('2026-03-10T10:00:00.000Z'),
        endTime: new Date('2026-03-10T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
      });
    });

    it('allows ADMIN to confirm a booking', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.CONFIRMED })
        .expect(200);

      expect(response.body).toMatchObject({ status: BookingStatus.CONFIRMED });
      expect(prisma.getNotificationsForBooking('booking-1')).toHaveLength(0);
    });

    it('forbids MASTER from confirming their own booking', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.CONFIRMED })
        .expect(403);
    });

    it('allows MASTER to cancel their own booking', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.CANCELLED })
        .expect(200);

      const notifications = prisma.getNotificationsForBooking('booking-1');
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: NotificationType.BOOKING_CANCELLATION,
        status: NotificationStatus.SENT,
      });
    });

    it('returns 404 when MASTER acts on another master booking', async () => {
      const token = await loginAs('master2@b4u.local', master2Password);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.CANCELLED })
        .expect(404);
    });

    it('rejects an invalid transition', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: BookingStatus.COMPLETED })
        .expect(409);
    });
  });
});
