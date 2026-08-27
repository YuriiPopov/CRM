import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Booking,
  BookingSource,
  BookingStatus,
  Client,
  DataDeletionRequest,
  Payment,
  Prisma,
  Role,
  Service,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { ClientsModule } from '../src/clients/clients.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Прогоняет реальные Clients-контроллер/сервис/guard'ы через HTTP поверх настоящего Auth-модуля
// (токен добывается через живой /auth/login), но с in-memory фейком PrismaService — реальная Postgres не нужна.
class FakePrismaService {
  private usersById = new Map<string, User>();
  private usersByEmail = new Map<string, User>();
  private clientsById = new Map<string, Client>();
  private servicesById = new Map<string, Service>();
  private bookingsById = new Map<string, Booking>();
  private paymentsByBookingId = new Map<string, Payment>();
  private dataDeletionRequestsById = new Map<string, DataDeletionRequest>();
  private nextClientId = 1;
  private nextDdrId = 1;

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
    create: ({
      data,
    }: {
      data: Omit<
        Client,
        'id' | 'createdAt' | 'email' | 'notes' | 'tags' | 'consentWithdrawnAt'
      > &
        Partial<Pick<Client, 'email' | 'notes' | 'tags'>>;
    }): Promise<Client> => {
      const client: Client = {
        id: `client-${this.nextClientId++}`,
        createdAt: new Date(),
        email: null,
        notes: null,
        tags: [],
        consentWithdrawnAt: null,
        ...data,
      };
      this.clientsById.set(client.id, client);
      return Promise.resolve(client);
    },
    findMany: ({
      where,
    }: {
      where: Prisma.ClientWhereInput;
    }): Promise<Client[]> => {
      return Promise.resolve(
        [...this.clientsById.values()].filter((client) =>
          this.matches(client, where),
        ),
      );
    },
    findFirst: ({
      where,
    }: {
      where: Prisma.ClientWhereInput;
    }): Promise<Client | null> => {
      const found = [...this.clientsById.values()].find((client) =>
        this.matches(client, where),
      );
      return Promise.resolve(found ?? null);
    },
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Client>;
    }): Promise<Client> => {
      const existing = this.clientsById.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.clientsById.set(where.id, updated);
      return Promise.resolve(updated);
    },
    delete: ({ where }: { where: { id: string } }): Promise<Client> => {
      const existing = this.clientsById.get(where.id);
      if (!existing) throw new Error('not found');
      const hasBookings = [...this.bookingsById.values()].some(
        (b) => b.clientId === where.id,
      );
      if (hasBookings) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint violated',
          { code: 'P2003', clientVersion: '6.19.3' },
        );
      }
      this.clientsById.delete(where.id);
      return Promise.resolve(existing);
    },
  };

  booking = {
    findMany: ({
      where,
    }: {
      where: { clientId?: string; masterId?: string };
    }): Promise<
      (Booking & { service: Service; payment: Payment | null })[]
    > => {
      const results = [...this.bookingsById.values()]
        .filter(
          (b) =>
            (!where.clientId || b.clientId === where.clientId) &&
            (!where.masterId || b.masterId === where.masterId),
        )
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        .map((b) => ({
          ...b,
          service: this.servicesById.get(b.serviceId)!,
          payment: this.paymentsByBookingId.get(b.id) ?? null,
        }));
      return Promise.resolve(results);
    },
  };

  dataDeletionRequest = {
    findFirst: ({
      where,
    }: {
      where: { clientId?: string; status?: string };
    }): Promise<DataDeletionRequest | null> => {
      const found = [...this.dataDeletionRequestsById.values()].find(
        (d) =>
          (!where.clientId || d.clientId === where.clientId) &&
          (!where.status || d.status === where.status),
      );
      return Promise.resolve(found ?? null);
    },
    create: ({
      data,
    }: {
      data: Omit<DataDeletionRequest, 'id' | 'requestedAt'>;
    }): Promise<DataDeletionRequest> => {
      const ddr: DataDeletionRequest = {
        id: `ddr-${this.nextDdrId++}`,
        requestedAt: new Date(),
        ...data,
      };
      this.dataDeletionRequestsById.set(ddr.id, ddr);
      return Promise.resolve(ddr);
    },
  };

  $transaction = (ops: Promise<unknown>[]): Promise<unknown[]> => {
    return Promise.all(ops);
  };

  private matches(client: Client, where: Prisma.ClientWhereInput): boolean {
    const w = where as {
      id?: string;
      salonId?: string;
      bookings?: { some?: { masterId?: string } };
    };

    if (w.id && client.id !== w.id) return false;
    if (w.salonId && client.salonId !== w.salonId) return false;

    const requiredMasterId = w.bookings?.some?.masterId;
    if (requiredMasterId) {
      const hasBookingWithMaster = [...this.bookingsById.values()].some(
        (b) => b.clientId === client.id && b.masterId === requiredMasterId,
      );
      if (!hasBookingWithMaster) return false;
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

  seedService(service: Service) {
    this.servicesById.set(service.id, service);
  }

  seedBooking(booking: Booking) {
    this.bookingsById.set(booking.id, booking);
  }

  seedPayment(payment: Payment) {
    this.paymentsByBookingId.set(payment.bookingId, payment);
  }
}

describe('Clients (e2e)', () => {
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
    // другой салон — проверяем изоляцию по salonId
    prisma.seedUser({
      id: 'admin-2',
      salonId: 'salon-2',
      email: 'admin2@b4u.local',
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: Role.ADMIN,
      masterId: null,
      isActive: true,
      createdAt: new Date(),
    });

    prisma.seedService({
      id: 'service-a',
      salonId: 'salon-1',
      name: 'Massage',
      categoryId: 'category-massage',
      durationMin: 60,
      price: 150 as unknown as Service['price'],
      createdAt: new Date(),
    });

    prisma.seedClient({
      id: 'client-a',
      salonId: 'salon-1',
      name: 'Client A (master 1)',
      phone: '+48000000001',
      email: 'client-a@example.com',
      notes: 'VIP',
      tags: ['vip'],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });
    prisma.seedBooking({
      id: 'booking-a1',
      salonId: 'salon-1',
      clientId: 'client-a',
      masterId: 'master-rec-1',
      serviceId: 'service-a',
      startTime: new Date('2026-01-10T10:00:00.000Z'),
      endTime: new Date('2026-01-10T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
    });
    prisma.seedPayment({
      id: 'payment-a1',
      bookingId: 'booking-a1',
      amount: 150 as unknown as Payment['amount'],
      discount: 0 as unknown as Payment['discount'],
      method: 'cash',
      status: 'paid',
      paidAt: new Date('2026-01-10T11:05:00.000Z'),
    });

    prisma.seedClient({
      id: 'client-b',
      salonId: 'salon-1',
      name: 'Client B (master 2)',
      phone: '+48000000002',
      email: null,
      notes: null,
      tags: [],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });
    prisma.seedBooking({
      id: 'booking-b1',
      salonId: 'salon-1',
      clientId: 'client-b',
      masterId: 'master-rec-2',
      serviceId: 'service-a',
      startTime: new Date('2026-01-11T10:00:00.000Z'),
      endTime: new Date('2026-01-11T11:00:00.000Z'),
      status: BookingStatus.COMPLETED,
      source: BookingSource.ADMIN,
      createdAt: new Date(),
    });

    prisma.seedClient({
      id: 'client-c',
      salonId: 'salon-1',
      name: 'Client C (no bookings)',
      phone: '+48000000003',
      email: null,
      notes: null,
      tags: [],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });

    prisma.seedClient({
      id: 'client-other-salon',
      salonId: 'salon-2',
      name: 'Client in another salon',
      phone: '+48000000004',
      email: null,
      notes: null,
      tags: [],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        ClientsModule,
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

  describe('POST /clients', () => {
    it('allows ADMIN to create a client with explicit consent', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Client', phone: '+48123456789', consentGiven: true })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Client',
        phone: '+48123456789',
        salonId: 'salon-1',
      });
      expect(response.body).toHaveProperty('consentGivenAt');
    });

    it('rejects creation without explicit consent', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Client',
          phone: '+48123456789',
          consentGiven: false,
        })
        .expect(400);
    });

    // Backlog п.5 — MASTER может завести клиента прямо из формы создания записи (нет
    // отдельной вкладки "Клиенты", см. AppRoutes/RequireRole на фронтенде).
    it('allows MASTER to create a client with explicit consent', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Client', phone: '+48123456789', consentGiven: true })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'New Client',
        phone: '+48123456789',
        salonId: 'salon-1',
      });
    });
  });

  describe('GET /clients', () => {
    it('lets ADMIN see every client in their own salon only', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Client[];
      const ids = body.map((c) => c.id).sort();
      expect(ids).toEqual(['client-a', 'client-b', 'client-c']);
    });

    // Backlog п.5 — MASTER видит весь список клиентов салона (та же выдача, что и ADMIN):
    // раньше сужалось до клиентов с записями к этому мастеру, что ломало выбор клиента в
    // форме создания новой записи (мастеру нужно видеть всех клиентов салона).
    it('lets MASTER see every client in their own salon, same as ADMIN', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Client[];
      const ids = body.map((c) => c.id).sort();
      expect(ids).toEqual(['client-a', 'client-b', 'client-c']);
    });
  });

  describe('GET /clients/:id', () => {
    it('lets a MASTER fetch a client outside their own bookings (Backlog п.5 — same salon-wide scope as GET /clients)', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/clients/client-b')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('returns the client when a MASTER requests one of their own bookings', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/clients/client-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('returns 404 for a client belonging to another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .get('/clients/client-other-salon')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /clients/:id', () => {
    it('forbids MASTER from updating clients', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .patch('/clients/client-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' })
        .expect(403);
    });

    it('allows ADMIN to update a client in their own salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .patch('/clients/client-a')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' })
        .expect(200);

      expect(response.body).toMatchObject({ id: 'client-a', name: 'Renamed' });
    });
  });

  describe('DELETE /clients/:id', () => {
    it('deletes a client with no bookings', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/clients/client-c')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('rejects deleting a client with existing bookings', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/clients/client-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });
  });

  describe('DELETE /clients/:id/gdpr-erasure', () => {
    it('forbids MASTER from erasing client data', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .delete('/clients/client-a/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('anonymizes a client with booking/payment history instead of deleting the row', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .delete('/clients/client-a/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        clientId: 'client-a',
        status: 'processed',
      });

      // Booking/Payment history survives — only identifying fields on the client are scrubbed
      const detail = await request(app.getHttpServer())
        .get('/clients/client-a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(detail.body).toMatchObject({
        id: 'client-a',
        name: 'Erased client',
        phone: 'erased-client-a',
        email: null,
        notes: null,
        tags: [],
      });
      expect(detail.body).toHaveProperty('consentWithdrawnAt');
    });

    it('anonymizes a client with no booking history via the same code path', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .delete('/clients/client-c/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        clientId: 'client-c',
        status: 'processed',
      });
    });

    it('rejects a repeat erasure request as already processed', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/clients/client-a/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/clients/client-a/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('returns 404 for a client belonging to another salon', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      await request(app.getHttpServer())
        .delete('/clients/client-other-salon/gdpr-erasure')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  interface ExportedBooking {
    id: string;
    serviceName: string;
    status: string;
    payment: {
      id: string;
      bookingId: string;
      paidAt: string;
      amount?: number;
    } | null;
  }

  interface ExportResponseBody {
    client: { id: string };
    bookings: ExportedBooking[];
    exportedAt: string;
  }

  describe('GET /clients/:id/export', () => {
    it('gives ADMIN the full card, booking history, and payment detail', async () => {
      const token = await loginAs('admin@b4u.local', adminPassword);

      const response = await request(app.getHttpServer())
        .get('/clients/client-a/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as ExportResponseBody;
      expect(body.client).toMatchObject({ id: 'client-a' });
      expect(body.bookings).toHaveLength(1);
      expect(body.bookings[0]).toMatchObject({
        id: 'booking-a1',
        serviceName: 'Massage',
        status: BookingStatus.COMPLETED,
      });
      expect(body.bookings[0].payment).toMatchObject({
        amount: 150,
        method: 'cash',
      });
      expect(body).toHaveProperty('exportedAt');
    });

    it('gives MASTER the client card but only their own bookings, with redacted payment detail', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/clients/client-a/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as ExportResponseBody;
      expect(body.bookings).toHaveLength(1);
      expect(body.bookings[0].payment).toEqual({
        id: 'payment-a1',
        bookingId: 'booking-a1',
        paidAt: '2026-01-10T11:05:00.000Z',
      });
      expect(body.bookings[0].payment).not.toHaveProperty('amount');
    });

    // Backlog п.5 — client lookup для export теперь salon-wide (как GET /clients/:id), но
    // история записей по-прежнему сужается до записей этого мастера (см. exportClientData) —
    // клиент найден, но его бронирования к другому мастеру в выгрузку не попадают.
    it('exports a client outside their own bookings for MASTER with an empty booking history', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/clients/client-b/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({ bookings: [] });
    });

    it('returns a null payment for a booking that was never paid', async () => {
      const token = await loginAs('master2@b4u.local', master2Password);

      const response = await request(app.getHttpServer())
        .get('/clients/client-b/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as ExportResponseBody;
      expect(body.bookings[0].payment).toBeNull();
    });
  });
});
