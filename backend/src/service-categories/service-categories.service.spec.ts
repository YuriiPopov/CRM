import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCategoriesService } from './service-categories.service';

describe('ServiceCategoriesService', () => {
  let service: ServiceCategoriesService;
  let prisma: {
    serviceCategory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    service: { updateMany: jest.Mock };
    masterSpecialization: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      serviceCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      service: { updateMany: jest.fn() },
      masterSpecialization: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ServiceCategoriesService);
  });

  describe('create', () => {
    it('creates a plain (non-default) category without a transaction', async () => {
      prisma.serviceCategory.create.mockResolvedValue({
        id: 'cat-1',
        salonId: 'salon-1',
        name: 'Брови',
        isDefault: false,
      });

      const result = await service.create(
        { name: 'Брови' },
        'salon-1',
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
        data: { salonId: 'salon-1', name: 'Брови', isDefault: false },
      });
      expect(result.id).toBe('cat-1');
    });

    it('unsets the previous default and creates the new default in one transaction', async () => {
      prisma.serviceCategory.updateMany.mockResolvedValue({ count: 1 });
      prisma.serviceCategory.create.mockResolvedValue({
        id: 'cat-2',
        salonId: 'salon-1',
        name: 'Брови',
        isDefault: true,
      });

      const result = await service.create(
        { name: 'Брови', isDefault: true },
        'salon-1',
      );

      expect(prisma.serviceCategory.updateMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1' },
        data: { isDefault: false },
      });
      expect(prisma.serviceCategory.create).toHaveBeenCalledWith({
        data: { salonId: 'salon-1', name: 'Брови', isDefault: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.isDefault).toBe(true);
    });
  });

  describe('update', () => {
    it('unsets other defaults and sets this one when isDefault: true', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        salonId: 'salon-1',
        name: 'СПА',
        isDefault: false,
      });
      prisma.serviceCategory.update.mockResolvedValue({
        id: 'cat-1',
        isDefault: true,
      });

      await service.update('cat-1', { isDefault: true }, 'salon-1');

      expect(prisma.serviceCategory.updateMany).toHaveBeenCalledWith({
        where: { salonId: 'salon-1', NOT: { id: 'cat-1' } },
        data: { isDefault: false },
      });
      expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { isDefault: true },
      });
    });

    it('rejects unsetting isDefault directly on the current default category', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        salonId: 'salon-1',
        isDefault: true,
      });

      await expect(
        service.update('cat-1', { isDefault: false }, 'salon-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('renames without touching isDefault when isDefault is not provided', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        salonId: 'salon-1',
        isDefault: false,
      });
      prisma.serviceCategory.update.mockResolvedValue({ id: 'cat-1' });

      await service.update('cat-1', { name: 'Массаж 2' }, 'salon-1');

      expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { name: 'Массаж 2' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a category in another salon', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.update('cat-1', { name: 'X' }, 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('rejects deleting the default category', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        salonId: 'salon-1',
        isDefault: true,
      });

      await expect(
        service.remove('cat-1', 'salon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reassigns services and specializations to the default category, then deletes', async () => {
      prisma.serviceCategory.findFirst
        .mockResolvedValueOnce({
          id: 'cat-1',
          salonId: 'salon-1',
          isDefault: false,
        })
        .mockResolvedValueOnce({
          id: 'cat-default',
          salonId: 'salon-1',
          isDefault: true,
        });
      prisma.masterSpecialization.findMany
        .mockResolvedValueOnce([{ masterId: 'm-1', categoryId: 'cat-1' }])
        .mockResolvedValueOnce([]);

      await service.remove('cat-1', 'salon-1');

      expect(prisma.service.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
        data: { categoryId: 'cat-default' },
      });
      expect(prisma.masterSpecialization.deleteMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1', masterId: { in: [] } },
      });
      expect(prisma.masterSpecialization.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
        data: { categoryId: 'cat-default' },
      });
      expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('drops the would-be-duplicate specialization instead of reassigning it', async () => {
      // master 'm-1' already has both the deleted category and the default category —
      // updateMany-ing its row onto categoryId=cat-default would collide with the
      // composite PK (masterId, categoryId) it already holds.
      prisma.serviceCategory.findFirst
        .mockResolvedValueOnce({
          id: 'cat-1',
          salonId: 'salon-1',
          isDefault: false,
        })
        .mockResolvedValueOnce({
          id: 'cat-default',
          salonId: 'salon-1',
          isDefault: true,
        });
      prisma.masterSpecialization.findMany
        .mockResolvedValueOnce([
          { masterId: 'm-1', categoryId: 'cat-1' },
          { masterId: 'm-2', categoryId: 'cat-1' },
        ])
        .mockResolvedValueOnce([{ masterId: 'm-1', categoryId: 'cat-default' }]);

      await service.remove('cat-1', 'salon-1');

      expect(prisma.masterSpecialization.deleteMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1', masterId: { in: ['m-1'] } },
      });
      expect(prisma.masterSpecialization.updateMany).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
        data: { categoryId: 'cat-default' },
      });
    });

    it('throws NotFoundException for a category in another salon', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('cat-1', 'salon-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
