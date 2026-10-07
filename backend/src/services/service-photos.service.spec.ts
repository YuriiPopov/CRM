import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectImageType,
  MAX_SERVICE_PHOTO_BYTES,
  ServicePhotosService,
} from './service-photos.service';

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function bytesOf(head: number[], total = 64): Buffer {
  const buf = Buffer.alloc(total, 7);
  Buffer.from(head).copy(buf);
  return buf;
}

function webpBytes(): Buffer {
  const buf = Buffer.alloc(64, 7);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

const asDataUrl = (buf: Buffer, mime = 'image/jpeg') =>
  `data:${mime};base64,${buf.toString('base64')}`;

interface CreateArgs {
  data: { position: number; image: string };
}
interface UpdateArgs {
  where: { id: string };
  data: { position: number };
}

describe('detectImageType', () => {
  it('recognizes JPEG, PNG and WebP by signature', () => {
    expect(detectImageType(bytesOf(JPEG_HEAD))).toBe('image/jpeg');
    expect(detectImageType(bytesOf(PNG_HEAD))).toBe('image/png');
    expect(detectImageType(webpBytes())).toBe('image/webp');
  });

  it('rejects GIF, plain text and empty input', () => {
    expect(detectImageType(Buffer.from('GIF89a-and-more'))).toBeNull();
    expect(
      detectImageType(Buffer.from('hello world, not an image')),
    ).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('ServicePhotosService', () => {
  let service: ServicePhotosService;
  let prisma: {
    service: { findFirst: jest.Mock };
    servicePhoto: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
      servicePhoto: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: CreateArgs) => ({
          id: 'photo-new',
          position: data.position,
          image: data.image,
        })),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicePhotosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ServicePhotosService);
  });

  describe('add', () => {
    it('stores a valid photo at the next position, scoped to the salon', async () => {
      prisma.servicePhoto.count.mockResolvedValue(2);

      const result = await service.add(
        'service-1',
        { image: asDataUrl(bytesOf(JPEG_HEAD)) },
        'salon-1',
      );

      expect(prisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'service-1', salonId: 'salon-1' },
        select: { id: true },
      });
      const { data } = (
        prisma.servicePhoto.create.mock.calls as [CreateArgs][]
      )[0][0];
      expect(data).toMatchObject({
        serviceId: 'service-1',
        salonId: 'salon-1',
        position: 2,
      });
      expect(result.position).toBe(2);
    });

    it('accepts raw base64 without the data URL prefix', async () => {
      await service.add(
        'service-1',
        { image: bytesOf(PNG_HEAD).toString('base64') },
        'salon-1',
      );

      const { data } = (
        prisma.servicePhoto.create.mock.calls as [CreateArgs][]
      )[0][0];
      expect(data.image.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('trusts the signature, not the declared mime', async () => {
      await service.add(
        'service-1',
        { image: asDataUrl(bytesOf(PNG_HEAD), 'image/jpeg') },
        'salon-1',
      );

      const { data } = (
        prisma.servicePhoto.create.mock.calls as [CreateArgs][]
      )[0][0];
      expect(data.image.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('rejects the sixth photo with 400', async () => {
      prisma.servicePhoto.count.mockResolvedValue(5);

      await expect(
        service.add(
          'service-1',
          { image: asDataUrl(bytesOf(JPEG_HEAD)) },
          'salon-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.servicePhoto.create).not.toHaveBeenCalled();
    });

    it('rejects an unsupported format even if it claims to be a JPEG', async () => {
      await expect(
        service.add(
          'service-1',
          { image: asDataUrl(Buffer.from('GIF89a-not-a-jpeg'), 'image/jpeg') },
          'salon-1',
        ),
      ).rejects.toThrow(/Unsupported image format/);
    });

    it('rejects an image above 1MB after decoding, accepts exactly 1MB', async () => {
      await expect(
        service.add(
          'service-1',
          {
            image: asDataUrl(bytesOf(JPEG_HEAD, MAX_SERVICE_PHOTO_BYTES + 1)),
          },
          'salon-1',
        ),
      ).rejects.toThrow(/1MB/);

      await expect(
        service.add(
          'service-1',
          { image: asDataUrl(bytesOf(JPEG_HEAD, MAX_SERVICE_PHOTO_BYTES)) },
          'salon-1',
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a service from another salon with 404 before touching photos', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.add(
          'service-1',
          { image: asDataUrl(bytesOf(JPEG_HEAD)) },
          'other-salon',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.servicePhoto.count).not.toHaveBeenCalled();
    });

    it('maps a unique-index race to 409', async () => {
      prisma.servicePhoto.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.add(
          'service-1',
          { image: asDataUrl(bytesOf(JPEG_HEAD)) },
          'salon-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      prisma.servicePhoto.findMany.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ]);
    });

    it('rewrites positions to the requested order', async () => {
      await service.reorder('service-1', ['c', 'a', 'b'], 'salon-1');

      const finalWrites = (
        prisma.servicePhoto.update.mock.calls as [UpdateArgs][]
      )
        .map(([arg]) => arg)
        .filter((arg) => arg.data.position < 100)
        .map((arg) => [arg.where.id, arg.data.position]);
      expect(finalWrites).toEqual([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ]);
    });

    it.each([
      ['a missing id', ['a', 'b']],
      ['a duplicate id', ['a', 'a', 'b']],
      ['a foreign id', ['a', 'b', 'x']],
      ['an extra id', ['a', 'b', 'c', 'd']],
    ])('rejects %s with 400', async (_name, ids) => {
      await expect(
        service.reorder('service-1', ids, 'salon-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.servicePhoto.update).not.toHaveBeenCalled();
    });

    it('rejects a body that is not an array of strings', async () => {
      await expect(
        service.reorder('service-1', { ids: ['a'] }, 'salon-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.reorder('service-1', ['a', 1], 'salon-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a service from another salon with 404', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.reorder('service-1', ['a', 'b', 'c'], 'other-salon'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the photo and closes the gap in positions', async () => {
      prisma.servicePhoto.findFirst.mockResolvedValue({ id: 'b' });
      prisma.servicePhoto.findMany.mockResolvedValue([
        { id: 'a', position: 0 },
        { id: 'c', position: 2 },
      ]);

      await service.remove('service-1', 'b', 'salon-1');

      expect(prisma.servicePhoto.delete).toHaveBeenCalledWith({
        where: { id: 'b' },
      });
      expect(prisma.servicePhoto.update).toHaveBeenCalledTimes(1);
      expect(prisma.servicePhoto.update).toHaveBeenCalledWith({
        where: { id: 'c' },
        data: { position: 1 },
      });
    });

    it('returns 404 for a photo of another service', async () => {
      prisma.servicePhoto.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('service-1', 'foreign', 'salon-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.servicePhoto.delete).not.toHaveBeenCalled();
    });

    it('returns 404 for a service from another salon', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('service-1', 'b', 'other-salon'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('client reads', () => {
    it('lists photo ids without image data, only for the client salon', async () => {
      await service.listForClient('service-1', 'salon-1');

      expect(prisma.servicePhoto.findMany).toHaveBeenCalledWith({
        where: { serviceId: 'service-1', salonId: 'salon-1' },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
    });

    it('returns binary bytes with the mime detected from the signature', async () => {
      prisma.servicePhoto.findFirst.mockResolvedValue({
        image: asDataUrl(bytesOf(PNG_HEAD), 'image/png'),
      });

      const { bytes, mime } = await service.getBinaryForClient(
        'photo-1',
        'salon-1',
      );

      expect(mime).toBe('image/png');
      expect(bytes.equals(bytesOf(PNG_HEAD))).toBe(true);
      expect(prisma.servicePhoto.findFirst).toHaveBeenCalledWith({
        where: { id: 'photo-1', salonId: 'salon-1' },
        select: { image: true },
      });
    });

    it('returns 404 for a photo of another salon', async () => {
      prisma.servicePhoto.findFirst.mockResolvedValue(null);

      await expect(
        service.getBinaryForClient('photo-1', 'other-salon'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
