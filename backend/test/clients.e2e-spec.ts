import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Client, Prisma, Role, User } from '@prisma/client';
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
  private bookings: { clientId: string; masterId: string }[] = [];
  private nextClientId = 1;

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
      const hasBookings = this.bookings.some((b) => b.clientId === where.id);
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
      const hasBookingWithMaster = this.bookings.some(
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

  seedBooking(clientId: string, masterId: string) {
    this.bookings.push({ clientId, masterId });
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

    prisma.seedClient({
      id: 'client-a',
      salonId: 'salon-1',
      name: 'Client A (master 1)',
      phone: '+48000000001',
      email: null,
      notes: null,
      tags: [],
      consentGivenAt: new Date(),
      consentWithdrawnAt: null,
      createdAt: new Date(),
    });
    prisma.seedBooking('client-a', 'master-rec-1');

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
    prisma.seedBooking('client-b', 'master-rec-2');

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

    it('forbids MASTER from creating clients', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Client', phone: '+48123456789', consentGiven: true })
        .expect(403);
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

    it('lets MASTER see only clients tied to their own bookings', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as Client[];
      expect(body.map((c) => c.id)).toEqual(['client-a']);
    });
  });

  describe('GET /clients/:id', () => {
    it('returns 404 when a MASTER requests a client outside their own bookings', async () => {
      const token = await loginAs('master1@b4u.local', master1Password);

      await request(app.getHttpServer())
        .get('/clients/client-b')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
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
});
