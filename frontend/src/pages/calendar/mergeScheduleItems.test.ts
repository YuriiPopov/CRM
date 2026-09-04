import { mergeScheduleItems } from './mergeScheduleItems'
import type { Booking } from '../../types/booking'
import type { MasterBlock } from '../../types/masterBlock'

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-03-10T10:00:00.000Z',
    endTime: '2026-03-10T11:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  }
}

function makeBlock(overrides: Partial<MasterBlock>): MasterBlock {
  return {
    id: 'block-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    startTime: '2026-03-10T15:00:00.000Z',
    endTime: '2026-03-10T16:00:00.000Z',
    reason: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    createdById: null,
    ...overrides,
  }
}

describe('mergeScheduleItems', () => {
  it('places a later block after an earlier booking, not before it', () => {
    const booking = makeBooking({ id: 'b-early', startTime: '2026-03-10T10:00:00.000Z' })
    const block = makeBlock({ id: 'bl-late', startTime: '2026-03-10T15:00:00.000Z' })

    const result = mergeScheduleItems([booking], [block])

    expect(result).toEqual([
      { kind: 'booking', booking },
      { kind: 'block', block },
    ])
  })

  it('places an earlier block before a later booking', () => {
    const block = makeBlock({ id: 'bl-early', startTime: '2026-03-10T08:00:00.000Z' })
    const booking = makeBooking({ id: 'b-late', startTime: '2026-03-10T14:00:00.000Z' })

    const result = mergeScheduleItems([booking], [block])

    expect(result).toEqual([
      { kind: 'block', block },
      { kind: 'booking', booking },
    ])
  })

  it('interleaves multiple bookings and blocks strictly by startTime', () => {
    const b1 = makeBooking({ id: 'b1', startTime: '2026-03-10T09:00:00.000Z' })
    const bl1 = makeBlock({ id: 'bl1', startTime: '2026-03-10T11:00:00.000Z' })
    const b2 = makeBooking({ id: 'b2', startTime: '2026-03-10T13:00:00.000Z' })
    const bl2 = makeBlock({ id: 'bl2', startTime: '2026-03-10T18:00:00.000Z' })

    const result = mergeScheduleItems([b2, b1], [bl2, bl1])

    expect(result.map((item) => (item.kind === 'booking' ? item.booking.id : item.block.id))).toEqual([
      'b1',
      'bl1',
      'b2',
      'bl2',
    ])
  })
})
