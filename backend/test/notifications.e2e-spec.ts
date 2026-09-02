import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Booking,
  BookingSource,
  BookingStatus,
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Role,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { NotificationsModule } from '../src/notifications/notifications.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface NotificationWhere {
  id?: string;
  status?: NotificationStatus;
  booking?: { salonId?: string };
  AND?: NotificationWhere[];
}

// Прогоняет реальные Notifications-контроллер/сервис/guard'ы через HTTP поверх настоящего Auth-модуля
// (токен добывается через живой /auth/login), но с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private bookingsById = new Map<string, Booking>();
  private notificationsById = new Map<string, Notification>();

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
    findUnique: ({
      where,
    }: {
      where: { id: string };
    }): Promise<Booking | null> => {
      return Promise.resolve(this.bookingsById.get(where.id) ?? null);
    },
  };

  notification = {
    findMany: ({
      where,
    }: {
      where: NotificationWhere;
    }): Promise<Notification[]> => {
      return Promise.resolve(
        [...this.notificationsById.values()].filter((n) =>
          this.matches(n, where),
        ),
      );
    },
    findFirst: ({
      where,
    }: {
      where: NotificationWhere;
    }): Promise<Notification | null> => {
      const found = [...this.notificationsById.values()].find((n) =>
        this.matches(n, where),
      );
      return Promise.resolve(found ?? null);
    },
  };

  private matches(
    notification: Notification,
    where: NotificationWhere,
  ): boolean {
    if (where.id && notification.id !== where.id) return false;
    if (where.status && notification.status !== where.status) return false;
    if (where.booking?.salonId) {
      const booking = this.bookingsById.get(notification.bookingId);
      if (!booking || booking.salonId !== where.booking.salonId) return false;
    }
    if (
      where.AND &&
      !where.AND.every((cond) => this.matches(notification, cond))
    ) {
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

  seedNotification(notification: Notification) {
    this.notificationsById.set(notification.id, notification);
  }
}

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

  const adminPassword = 'AdminPass1';
  const masterPassword = 'MasterPass1';

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
      email: 'master@b4u.local',
      passwordHash: await bcrypt.hash(masterPassword, 4),
      role: Role.MASTER,
      masterId: 'master-rec-1',
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedBooking({
      id: 'booking-salon-1',
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-1',
      serviceId: 'service-a',
      startTime: new Date('2026-01-10T10:00:00.000Z'),
      endTime: new Date('2026-01-10T11:00:00.000Z'),
      status: BookingStatus.CREATED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });
    prisma.seedBooking({
      id: 'booking-salon-2',
      salonId: 'salon-2',
      clientId: 'client-x',
      masterId: 'master-other',
      serviceId: 'service-x',
      startTime: new Date('2026-01-11T10:00:00.000Z'),
      endTime: new Date('2026-01-11T11:00:00.000Z'),
      status: BookingStatus.CREATED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
      rescheduledAt: null,
    });

    prisma.seedNotification({
      id: 'notification-sent',
      bookingId: 'booking-salon-1',
      type: NotificationType.BOOKING_CONFIRMATION,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
      sentAt: new Date('2026-01-10T09:00:00.000Z'),
      createdAt: new Date('2026-01-10T09:00:00.000Z'),
    });
    prisma.seedNotification({
      id: 'notification-failed',
      bookingId: 'booking-salon-1',
      type: NotificationType.BOOKING_CANCELLATION,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.FAILED,
      sentAt: null,
      createdAt: new Date('2026-01-10T09:05:00.000Z'),
    });
    prisma.seedNotification({
      id: 'notification-other-salon',
      bookingId: 'booking-salon-2',
      type: NotificationType.BOOKING_CONFIRMATION,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.SENT,
      sentAt: new Date('2026-01-11T09:00:00.000Z'),
      createdAt: new Date('2026-01-11T09:00:00.000Z'),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        NotificationsModule,
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

  describe('GET /notifications', () => {
    it('lets ADMIN see only their own salon notifications', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Notification[];
      expect(body.map((n) => n.id).sort()).toEqual([
        'notification-failed',
        'notification-sent',
      ]);
    });

    it('filters by status', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/notifications?status=FAILED')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Notification[];
      expect(body.map((n) => n.id)).toEqual(['notification-failed']);
    });

    it('forbids MASTER from any access', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('GET /notifications/:id', () => {
    it('returns 404 for a notification belonging to another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .get('/notifications/notification-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns the notification when in scope', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/notifications/notification-sent')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'notification-sent',
        status: NotificationStatus.SENT,
        type: NotificationType.BOOKING_CONFIRMATION,
      });
    });

    it('forbids MASTER from reading a single notification', async () => {
      const token = await loginAs('master@b4u.local', masterPassword);

      await request(app.getHttpServer())
        .get('/notifications/notification-sent')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
