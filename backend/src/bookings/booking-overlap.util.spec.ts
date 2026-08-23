import { BookingStatus } from '@prisma/client';
import {
  addMinutes,
  BOOKING_BUFFER_MINUTES,
  findOverlappingBlock,
  findOverlappingBooking,
} from './booking-overlap.util';

describe('addMinutes', () => {
  it('shifts a date forward and backward by the given number of minutes', () => {
    const base = new Date('2026-01-10T10:00:00.000Z');

    expect(addMinutes(base, 10).toISOString()).toBe('2026-01-10T10:10:00.000Z');
    expect(addMinutes(base, -10).toISOString()).toBe(
      '2026-01-10T09:50:00.000Z',
    );
  });
});

describe('findOverlappingBooking', () => {
  const startTime = new Date('2026-01-10T10:00:00.000Z');
  const endTime = new Date('2026-01-10T11:00:00.000Z');

  it('queries an exact (unpadded) window when no buffer is given', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { booking: { findFirst } } as unknown as Parameters<
      typeof findOverlappingBooking
    >[0];

    await findOverlappingBooking(prisma, 'master-1', startTime, endTime);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        masterId: 'master-1',
        status: { notIn: [BookingStatus.CANCELLED] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
  });

  it('pads the query window on both sides by the buffer (Backlog п.10)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { booking: { findFirst } } as unknown as Parameters<
      typeof findOverlappingBooking
    >[0];

    await findOverlappingBooking(
      prisma,
      'master-1',
      startTime,
      endTime,
      undefined,
      BOOKING_BUFFER_MINUTES,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        masterId: 'master-1',
        status: { notIn: [BookingStatus.CANCELLED] },
        startTime: { lt: new Date('2026-01-10T11:10:00.000Z') },
        endTime: { gt: new Date('2026-01-10T09:50:00.000Z') },
      },
    });
  });

  it('excludes the given booking id when rescheduling', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { booking: { findFirst } } as unknown as Parameters<
      typeof findOverlappingBooking
    >[0];

    await findOverlappingBooking(
      prisma,
      'master-1',
      startTime,
      endTime,
      'booking-1',
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` in @types/jest
        where: expect.objectContaining({ id: { not: 'booking-1' } }),
      }),
    );
  });
});

describe('findOverlappingBlock', () => {
  it('queries the exact block window, without any buffer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { masterBlock: { findFirst } } as unknown as Parameters<
      typeof findOverlappingBlock
    >[0];
    const startTime = new Date('2026-01-10T10:00:00.000Z');
    const endTime = new Date('2026-01-10T11:00:00.000Z');

    await findOverlappingBlock(prisma, 'master-1', startTime, endTime);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        masterId: 'master-1',
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
  });
});
