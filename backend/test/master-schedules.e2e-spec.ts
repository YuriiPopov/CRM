import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { MasterSchedulesModule } from '../src/master-schedules/master-schedules.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const MASTER_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const adminPassword = 'admin-password';

interface FakeBooking {
  id: string;
  salonId: string;
  masterId: string;
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
}

interface BookingWhere {
  salonId: string;
  masterId: string;
  status: { in: BookingStatus[] };
  startTime: { gte: Date };
  OR: { startTime: { gte: Date; lt: Date } }[];
}

// Реальные контроллер/сервис/guard'ы master-schedules через HTTP поверх настоящего Auth-модуля,
// с in-memory фейком PrismaService: booking.findMany честно применяет where, который строит сервис.
class FakePrismaService {
  private users = new Map<string, User>();
  bookings: FakeBooking[] = [];

  seedUser(user: User) {
    this.users.set(user.id, user);
  }

  user = {
    findUnique: ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<User | null> =>
      Promise.resolve(
        [...this.users.values()].find(
          (u) => u.id === where.id || u.email === where.email,
        ) ?? null,
      ),
  };

  master = {
    findFirst: ({
      where,
    }: {
      where: { id: string; salonId: string };
    }): Promise<{ id: string } | null> =>
      Promise.resolve(
        where.id === MASTER_ID && where.salonId === 'salon-1'
          ? { id: MASTER_ID }
          : null,
      ),
  };

  booking = {
    findMany: ({ where }: { where: BookingWhere }): Promise<FakeBooking[]> =>
      Promise.resolve(
        this.bookings
          .filter(
            (b) =>
              b.salonId === where.salonId &&
              b.masterId === where.masterId &&
              where.status.in.includes(b.status) &&
              b.startTime >= where.startTime.gte &&
              where.OR.some(
                (r) =>
                  b.startTime >= r.startTime.gte &&
                  b.startTime < r.startTime.lt,
              ),
          )
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      ),
  };
}

describe('MasterSchedules conflicts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;
  let token: string;

  const at = (date: string, start: string, end: string) => ({
    startTime: new Date(`${date}T${start}:00.000Z`),
    endTime: new Date(`${date}T${end}:00.000Z`),
  });

  function seedBooking(
    id: string,
    date: string,
    start: string,
    end: string,
    status: BookingStatus = BookingStatus.CONFIRMED,
  ) {
    prisma.bookings.push({
      id,
      salonId: 'salon-1',
      masterId: MASTER_ID,
      status,
      ...at(date, start, end),
    });
  }

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    // «Сейчас» в Варшаве — 2026-03-01 13:00; записи 3 марта — будущие, 28 февраля — прошедшие
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout'],
    });
    jest.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));

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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        MasterSchedulesModule,
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

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@b4u.local', password: adminPassword })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterEach(async () => {
    await app.close();
    jest.useRealTimers();
  });

  const postConflicts = (days: object[]) =>
    request(app.getHttpServer())
      .post('/master-schedules/conflicts')
      .set('Authorization', `Bearer ${token}`)
      .send({ masterId: MASTER_ID, year: 2026, month: 3, days });

  const ids = (body: unknown) =>
    (body as { id: string; reason: string }[]).map((b) => [b.id, b.reason]);

  it('narrowing 09–19 to 09–14 reports 16:00 and 13:30–14:30 as OUTSIDE_HOURS, not 10:00', async () => {
    seedBooking('inside', '2026-03-03', '10:00', '11:00');
    seedBooking('late', '2026-03-03', '16:00', '17:00');
    seedBooking('partial', '2026-03-03', '13:30', '14:30');

    const res = await postConflicts([
      {
        date: '2026-03-03',
        isWorking: true,
        startTime: '09:00',
        endTime: '14:00',
      },
    ]).expect(201);

    expect(ids(res.body)).toEqual([
      ['partial', 'OUTSIDE_HOURS'],
      ['late', 'OUTSIDE_HOURS'],
    ]);
  });

  it('a new day off reports that day’s bookings as DAY_OFF and keeps existing fields', async () => {
    seedBooking('b1', '2026-03-03', '10:00', '11:00');
    seedBooking('other-day', '2026-03-04', '10:00', '11:00');

    const res = await postConflicts([
      { date: '2026-03-03', isWorking: false },
    ]).expect(201);

    const body = res.body as Record<string, unknown>[];
    expect(ids(body)).toEqual([['b1', 'DAY_OFF']]);
    expect(body[0]).toMatchObject({
      id: 'b1',
      masterId: MASTER_ID,
      status: 'CONFIRMED',
      startTime: '2026-03-03T10:00:00.000Z',
      endTime: '2026-03-03T11:00:00.000Z',
    });
  });

  it('ignores cancelled, completed, no-show and past bookings', async () => {
    seedBooking(
      'cancelled',
      '2026-03-03',
      '16:00',
      '17:00',
      BookingStatus.CANCELLED,
    );
    seedBooking(
      'completed',
      '2026-03-03',
      '16:00',
      '17:00',
      BookingStatus.COMPLETED,
    );
    seedBooking(
      'no-show',
      '2026-03-03',
      '16:00',
      '17:00',
      BookingStatus.NO_SHOW,
    );
    seedBooking('past', '2026-03-01', '09:30', '10:30');
    seedBooking(
      'created',
      '2026-03-03',
      '16:00',
      '17:00',
      BookingStatus.CREATED,
    );

    const res = await postConflicts([
      {
        date: '2026-03-01',
        isWorking: true,
        startTime: '11:00',
        endTime: '14:00',
      },
      {
        date: '2026-03-03',
        isWorking: true,
        startTime: '09:00',
        endTime: '14:00',
      },
    ]).expect(201);

    expect(ids(res.body)).toEqual([['created', 'OUTSIDE_HOURS']]);
  });
});
