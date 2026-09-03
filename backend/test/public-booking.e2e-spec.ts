import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Booking,
  BookingSource,
  BookingStatus,
  Client,
  Master,
  MasterService,
  Service,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicBookingModule } from '../src/public-booking/public-booking.module';

const MASTER_ID = '22222222-2222-4222-8222-222222222222';
const MASTER_INACTIVE_ID = '99999999-9999-4999-8999-999999999999';
const SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const SERVICE_OTHER_SALON_ID = '55555555-5555-4555-8555-555555555555';

// Прогоняет реальные PublicBooking-контроллер/сервис/ThrottlerGuard через HTTP —
// без авторизации, с in-memory фейком PrismaService (реальная Postgres не нужна).
class FakePrismaService {
  private mastersById = new Map<string, Master>();
  private servicesById = new Map<string, Service>();
  private masterServices: MasterService[] = [];
  private bookingsById = new Map<string, Booking>();
  private clientsById = new Map<string, Client>();
  private nextBookingId = 1;
  private nextClientId = 1;

  master = {
    findFirst: ({
      where,
    }: {
      where: { id?: string; isActive?: boolean };
    }): Promise<Master | null> => {
      const found = [...this.mastersById.values()].find(
        (m) =>
          (!where.id || m.id === where.id) &&
          (where.isActive === undefined || m.isActive === where.isActive),
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

  masterService = {
    findUnique: ({
      where,
    }: {
      where: { masterId_serviceId: { masterId: string; serviceId: string } };
    }): Promise<MasterService | null> => {
      const { masterId, serviceId } = where.masterId_serviceId;
      const found = this.masterServices.find(
        (l) => l.masterId === masterId && l.serviceId === serviceId,
      );
      return Promise.resolve(found ?? null);
    },
  };

  booking = {
    findMany: ({
      where,
    }: {
      where: {
        masterId?: string;
        startTime?: { lt?: Date };
        endTime?: { gt?: Date };
      };
    }): Promise<Booking[]> => {
      return Promise.resolve(
        [...this.bookingsById.values()].filter(
          (b) =>
            (!where.masterId || b.masterId === where.masterId) &&
            (!where.startTime?.lt || b.startTime < where.startTime.lt) &&
            (!where.endTime?.gt || b.endTime > where.endTime.gt),
        ),
      );
    },
    findFirst: ({
      where,
    }: {
      where: {
        masterId?: string;
        startTime?: { lt?: Date };
        endTime?: { gt?: Date };
      };
    }): Promise<Booking | null> => {
      const found = [...this.bookingsById.values()].find(
        (b) =>
          (!where.masterId || b.masterId === where.masterId) &&
          (!where.startTime?.lt || b.startTime < where.startTime.lt) &&
          (!where.endTime?.gt || b.endTime > where.endTime.gt),
      );
      return Promise.resolve(found ?? null);
    },
    create: ({
      data,
    }: {
      data: Omit<Booking, 'id' | 'createdAt' | 'status'>;
    }): Promise<Booking> => {
      const booking: Booking = {
        id: `booking-${this.nextBookingId++}`,
        createdAt: new Date(),
        status: BookingStatus.CREATED,
        ...data,
      };
      this.bookingsById.set(booking.id, booking);
      return Promise.resolve(booking);
    },
  };

  client = {
    findFirst: ({
      where,
    }: {
      where: { salonId: string; phone: string };
    }): Promise<Client | null> => {
      const found = [...this.clientsById.values()].find(
        (c) => c.salonId === where.salonId && c.phone === where.phone,
      );
      return Promise.resolve(found ?? null);
    },
    create: ({
      data,
    }: {
      data: Omit<
        Client,
        'id' | 'createdAt' | 'tags' | 'notes' | 'consentWithdrawnAt'
      >;
    }): Promise<Client> => {
      const client: Client = {
        id: `client-${this.nextClientId++}`,
        createdAt: new Date(),
        tags: [],
        notes: null,
        consentWithdrawnAt: null,
        ...data,
      };
      this.clientsById.set(client.id, client);
      return Promise.resolve(client);
    },
  };

  seedMaster(master: Master) {
    this.mastersById.set(master.id, master);
  }

  seedService(service: Service) {
    this.servicesById.set(service.id, service);
  }

  seedMasterService(masterId: string, serviceId: string) {
    this.masterServices.push({ masterId, serviceId });
  }

  seedBooking(booking: Booking) {
    this.bookingsById.set(booking.id, booking);
  }

  getClients(): Client[] {
    return [...this.clientsById.values()];
  }
}

describe('Public booking (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrismaService;

  beforeEach(async () => {
    prisma = new FakePrismaService();

    prisma.seedMaster({
      id: MASTER_ID,
      salonId: 'salon-1',
      name: 'Anna',
      isActive: true,
      createdAt: new Date(),
    });
    prisma.seedMaster({
      id: MASTER_INACTIVE_ID,
      salonId: 'salon-1',
      name: 'Retired Master',
      isActive: false,
      createdAt: new Date(),
    });
    prisma.seedService({
      id: SERVICE_ID,
      salonId: 'salon-1',
      name: 'Massage',
      categoryId: 'category-massage',
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });
    prisma.seedService({
      id: SERVICE_OTHER_SALON_ID,
      salonId: 'salon-2',
      name: 'Massage elsewhere',
      categoryId: 'category-massage-salon-2',
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });
    prisma.seedMasterService(MASTER_ID, SERVICE_ID);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, PublicBookingModule],
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

  describe('GET /public/booking/slots', () => {
    it('requires no authentication and returns only free slots, no booking/client details', async () => {
      prisma.seedBooking({
        id: 'existing-1',
        salonId: 'salon-1',
        clientId: 'some-client',
        masterId: MASTER_ID,
        serviceId: SERVICE_ID,
        startTime: new Date('2099-06-15T10:00:00.000Z'),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
        rescheduledAt: null,
        originalStartTime: null,
        originalEndTime: null,
      });

      const response = await request(app.getHttpServer())
        .get('/public/booking/slots')
        .query({
          masterId: MASTER_ID,
          serviceId: SERVICE_ID,
          date: '2099-06-15',
        })
        .expect(200);

      const body = response.body as { slots: { startTime: string }[] };
      expect(
        body.slots.some((s) => s.startTime === '2099-06-15T10:00:00.000Z'),
      ).toBe(false);
      expect(
        body.slots.some((s) => s.startTime === '2099-06-15T09:00:00.000Z'),
      ).toBe(true);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('some-client');
      expect(raw).not.toContain('existing-1');
    });

    it('rejects an inactive master', async () => {
      await request(app.getHttpServer())
        .get('/public/booking/slots')
        .query({
          masterId: MASTER_INACTIVE_ID,
          serviceId: SERVICE_ID,
          date: '2099-06-15',
        })
        .expect(404);
    });

    it('rejects a service the master does not offer', async () => {
      prisma.seedService({
        id: '66666666-6666-4666-8666-666666666666',
        salonId: 'salon-1',
        name: 'Unrelated service',
        categoryId: 'category-manicure',
        durationMin: 30,
        price: 50 as unknown as Service['price'],
        createdAt: new Date(),
      });

      await request(app.getHttpServer())
        .get('/public/booking/slots')
        .query({
          masterId: MASTER_ID,
          serviceId: '66666666-6666-4666-8666-666666666666',
          date: '2099-06-15',
        })
        .expect(404);
    });

    it('rejects a service from another salon', async () => {
      await request(app.getHttpServer())
        .get('/public/booking/slots')
        .query({
          masterId: MASTER_ID,
          serviceId: SERVICE_OTHER_SALON_ID,
          date: '2099-06-15',
        })
        .expect(404);
    });

    it('rejects a malformed date', async () => {
      await request(app.getHttpServer())
        .get('/public/booking/slots')
        .query({
          masterId: MASTER_ID,
          serviceId: SERVICE_ID,
          date: 'not-a-date',
        })
        .expect(400);
    });
  });

  describe('POST /public/booking', () => {
    const validBody = {
      masterId: MASTER_ID,
      serviceId: SERVICE_ID,
      startTime: '2099-06-15T10:00:00.000Z',
      clientName: 'Anna Client',
      clientPhone: '+48123123123',
      consentGiven: true,
    };

    it('creates a booking with source ONLINE and returns only minimal booking info', async () => {
      const response = await request(app.getHttpServer())
        .post('/public/booking')
        .send(validBody)
        .expect(201);

      expect(response.body).toMatchObject({
        startTime: '2099-06-15T10:00:00.000Z',
        status: BookingStatus.CREATED,
      });
      expect(response.body).not.toHaveProperty('salonId');
      expect(response.body).not.toHaveProperty('clientId');

      const clients = prisma.getClients();
      expect(clients).toHaveLength(1);
      expect(clients[0]).toMatchObject({
        name: 'Anna Client',
        phone: '+48123123123',
      });
    });

    it('rejects creation without explicit consent', async () => {
      await request(app.getHttpServer())
        .post('/public/booking')
        .send({ ...validBody, consentGiven: false })
        .expect(400);
    });

    it('rejects booking an inactive master', async () => {
      await request(app.getHttpServer())
        .post('/public/booking')
        .send({ ...validBody, masterId: MASTER_INACTIVE_ID })
        .expect(404);
    });

    it('rejects an overlapping slot', async () => {
      prisma.seedBooking({
        id: 'existing-1',
        salonId: 'salon-1',
        clientId: 'some-client',
        masterId: MASTER_ID,
        serviceId: SERVICE_ID,
        startTime: new Date('2099-06-15T10:00:00.000Z'),
        endTime: new Date('2099-06-15T11:00:00.000Z'),
        status: BookingStatus.CREATED,
        source: BookingSource.ADMIN,
        createdAt: new Date(),
        rescheduledAt: null,
        originalStartTime: null,
        originalEndTime: null,
      });

      await request(app.getHttpServer())
        .post('/public/booking')
        .send(validBody)
        .expect(409);
    });

    it('rejects a time in the past', async () => {
      await request(app.getHttpServer())
        .post('/public/booking')
        .send({ ...validBody, startTime: '2020-01-01T10:00:00.000Z' })
        .expect(400);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 after exceeding the create-booking limit (5/min)', async () => {
      const send = (startHour: number) =>
        request(app.getHttpServer())
          .post('/public/booking')
          .send({
            masterId: MASTER_ID,
            serviceId: SERVICE_ID,
            startTime: `2099-06-20T${String(startHour).padStart(2, '0')}:00:00.000Z`,
            clientName: 'Rate Limit Tester',
            clientPhone: '+48000000099',
            consentGiven: true,
          });

      const results: Awaited<ReturnType<typeof send>>[] = [];
      for (let i = 0; i < 6; i += 1) {
        results.push(await send(9 + i));
      }

      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429)).toHaveLength(1);
    });
  });
});
