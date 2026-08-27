import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: {
    service: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    serviceCategory: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      service: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      serviceCategory: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  describe('create', () => {
    it('creates a service scoped to the salon', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: 'category-1',
        salonId: 'salon-1',
      });
      prisma.service.create.mockResolvedValue({ id: 'service-1' });

      await service.create(
        {
          name: 'Manicure',
          categoryId: 'category-1',
          durationMin: 60,
          price: 120,
        },
        'salon-1',
      );

      expect(prisma.serviceCategory.findFirst).toHaveBeenCalledWith({
        where: { id: 'category-1', salonId: 'salon-1' },
      });
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: {
          salonId: 'salon-1',
          name: 'Manicure',
          categoryId: 'category-1',
          durationMin: 60,
          price: 120,
        },
      });
    });

    it('rejects a categoryId that does not belong to the salon', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Manicure',
            categoryId: 'category-1',
            durationMin: 60,
            price: 120,
          },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes to the salon only, no role branching', async () => {
      prisma.service.findMany.mockResolvedValue([]);

      await service.findAll('salon-1');

      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the service when found in the salon', async () => {
      const found = { id: 'service-1', salonId: 'salon-1' };
      prisma.service.findFirst.mockResolvedValue(found);

      await expect(service.findOne('service-1', 'salon-1')).resolves.toBe(
        found,
      );
    });

    it('throws NotFoundException when not found in the salon', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('service-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the service is out of scope', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.update('service-1', { price: 150 }, 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('updates only the provided fields', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        salonId: 'salon-1',
      });
      prisma.service.update.mockResolvedValue({ id: 'service-1' });

      await service.update('service-1', { price: 150 }, 'salon-1');

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'service-1' },
        data: { price: 150 },
      });
    });

    it('validates a provided categoryId belongs to the salon', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        salonId: 'salon-1',
      });
      prisma.serviceCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'service-1',
          { categoryId: 'category-other-salon' },
          'salon-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the service is out of scope', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('service-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.delete).not.toHaveBeenCalled();
    });

    it('deletes a service that is not referenced elsewhere', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        salonId: 'salon-1',
      });
      prisma.service.delete.mockResolvedValue({ id: 'service-1' });

      await expect(
        service.remove('service-1', 'salon-1'),
      ).resolves.toBeUndefined();
    });

    it('rejects deletion of a service still referenced by masters/bookings/materials', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'service-1',
        salonId: 'salon-1',
      });
      prisma.service.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint violated',
          { code: 'P2003', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        service.remove('service-1', 'salon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
