import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    client: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@b4u.local',
    role: Role.ADMIN,
    salonId: 'salon-1',
    masterId: null,
  };

  const master: AuthenticatedUser = {
    id: 'master-user-1',
    email: 'master@b4u.local',
    role: Role.MASTER,
    salonId: 'salon-1',
    masterId: 'master-rec-1',
  };

  beforeEach(async () => {
    prisma = {
      client: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClientsService);
  });

  describe('create', () => {
    it('rejects creation without explicit consent', async () => {
      await expect(
        service.create(
          { name: 'Anna', phone: '+48123123123', consentGiven: false },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('creates a client scoped to the salon and stamps consentGivenAt', async () => {
      prisma.client.create.mockResolvedValue({ id: 'client-1' });

      await service.create(
        { name: 'Anna', phone: '+48123123123', consentGiven: true },
        'salon-1',
      );

      expect(prisma.client.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        data: expect.objectContaining({
          salonId: 'salon-1',
          name: 'Anna',
          phone: '+48123123123',
          tags: [],
          consentGivenAt: expect.any(Date) as Date,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('scopes ADMIN to the whole salon', async () => {
      prisma.client.findMany.mockResolvedValue([]);

      await service.findAll(admin);

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('scopes MASTER to clients with their own bookings', async () => {
      prisma.client.findMany.mockResolvedValue([]);

      await service.findAll(master);

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: {
          salonId: 'salon-1',
          bookings: { some: { masterId: 'master-rec-1' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns nothing for a MASTER without a linked master profile', async () => {
      prisma.client.findMany.mockResolvedValue([]);

      await service.findAll({ ...master, masterId: null });

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { id: '__none__' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the client when it is in scope', async () => {
      const client = { id: 'client-1', salonId: 'salon-1' };
      prisma.client.findFirst.mockResolvedValue(client);

      await expect(service.findOne('client-1', admin)).resolves.toBe(client);
    });

    it('throws NotFoundException when the client is out of scope', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne('client-1', master)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the client does not belong to the salon', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.update('client-1', { name: 'New name' }, 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.client.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields and stamps consentWithdrawnAt', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        salonId: 'salon-1',
      });
      prisma.client.update.mockResolvedValue({ id: 'client-1' });

      await service.update(
        'client-1',
        { name: 'New name', consentWithdrawn: true },
        'salon-1',
      );

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          name: 'New name',
          consentWithdrawnAt: expect.any(Date) as Date,
        },
      });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the client does not belong to the salon', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('client-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.client.delete).not.toHaveBeenCalled();
    });

    it('deletes a client with no bookings', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        salonId: 'salon-1',
      });
      prisma.client.delete.mockResolvedValue({ id: 'client-1' });

      await expect(
        service.remove('client-1', 'salon-1'),
      ).resolves.toBeUndefined();
    });

    it('rejects deletion of a client with existing bookings', async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        salonId: 'salon-1',
      });
      prisma.client.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint violated',
          { code: 'P2003', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        service.remove('client-1', 'salon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
