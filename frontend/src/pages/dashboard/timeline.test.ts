import {
  filterActiveTimelineBookings,
  groupTimelineBlocksByMaster,
  layoutBookingsOnTimeline,
  layoutMasterBlocksOnTimeline,
  scheduleUnavailableSegments,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  truncateMasterName,
} from './timeline'
import type { Booking, BookingStatus } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'
import type { MasterScheduleRecord } from '../../types/masterSchedule'

function makeMasterBlock(overrides: Partial<MasterBlock>): MasterBlock {
  return {
    id: 'block-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    startTime: '2026-03-10T10:00:00.000Z',
    endTime: '2026-03-10T11:00:00.000Z',
    reason: 'Перерыв',
    createdAt: '2026-03-01T00:00:00.000Z',
    createdById: null,
    ...overrides,
  }
}

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

function makeScheduleRecord(overrides: Partial<MasterScheduleRecord>): MasterScheduleRecord {
  return {
    id: 'schedule-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    date: '2026-03-10T00:00:00.000Z',
    isWorking: true,
    startTime: '09:00',
    endTime: '19:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeMaster(overrides: Partial<Master>): Master {
  return {
    id: 'master-1',
    salonId: 'salon-1',
    name: 'Anna',
    specializationCategoryIds: ['category-spa'],
    isActive: true,
    photo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('filterActiveTimelineBookings', () => {
  it('keeps CREATED, CONFIRMED, and COMPLETED bookings', () => {
    const bookings = (['CREATED', 'CONFIRMED', 'COMPLETED'] as BookingStatus[]).map((status) =>
      makeBooking({ id: `b-${status}`, status }),
    )
    expect(filterActiveTimelineBookings(bookings).map((b) => b.id)).toEqual([
      'b-CREATED',
      'b-CONFIRMED',
      'b-COMPLETED',
    ])
  })

  it('excludes CANCELLED bookings', () => {
    const cancelled = makeBooking({ id: 'b-cancelled', status: 'CANCELLED' })
    const active = makeBooking({ id: 'b-active', status: 'CREATED' })
    expect(filterActiveTimelineBookings([cancelled, active]).map((b) => b.id)).toEqual(['b-active'])
  })
})

describe('layoutBookingsOnTimeline', () => {
  it('positions a booking at the start of the working window at 0%', () => {
    const booking = makeBooking({
      startTime: `2026-03-10T${String(TIMELINE_START_HOUR).padStart(2, '0')}:00:00.000Z`,
      endTime: `2026-03-10T${String(TIMELINE_START_HOUR).padStart(2, '0')}:30:00.000Z`,
    })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent).toBe(0)
  })

  it('positions a booking spanning the full working window at 0%..100%', () => {
    const booking = makeBooking({
      startTime: `2026-03-10T${String(TIMELINE_START_HOUR).padStart(2, '0')}:00:00.000Z`,
      endTime: `2026-03-10T${String(TIMELINE_END_HOUR).padStart(2, '0')}:00:00.000Z`,
    })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent).toBe(0)
    expect(block.widthPercent).toBe(100)
  })

  it('positions a booking exactly in the middle of the window at 50%', () => {
    // Window is 09:00-19:00 (10h = 600min); a 1h booking starting at (09:00 + 300min) = 14:00
    const booking = makeBooking({ startTime: '2026-03-10T14:00:00.000Z', endTime: '2026-03-10T15:00:00.000Z' })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent).toBeCloseTo(50, 5)
  })

  it('clamps a booking that starts before the working window to the left edge', () => {
    const booking = makeBooking({ startTime: '2026-03-10T07:00:00.000Z', endTime: '2026-03-10T09:30:00.000Z' })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent).toBe(0)
  })

  it('clamps a booking that ends after the working window to the right edge', () => {
    const booking = makeBooking({
      startTime: `2026-03-10T${String(TIMELINE_END_HOUR - 1).padStart(2, '0')}:30:00.000Z`,
      endTime: `2026-03-10T${String(TIMELINE_END_HOUR + 1).padStart(2, '0')}:00:00.000Z`,
    })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent + block.widthPercent).toBeCloseTo(100, 5)
  })

  it('does not clip a booking ending exactly at the working window boundary (19:00)', () => {
    const booking = makeBooking({
      startTime: `2026-03-10T${String(TIMELINE_END_HOUR - 1).padStart(2, '0')}:30:00.000Z`,
      endTime: `2026-03-10T${String(TIMELINE_END_HOUR).padStart(2, '0')}:00:00.000Z`,
    })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.leftPercent + block.widthPercent).toBeCloseTo(100, 5)
  })

  it('enforces a minimum visible width for a very short booking', () => {
    const booking = makeBooking({ startTime: '2026-03-10T14:00:00.000Z', endTime: '2026-03-10T14:02:00.000Z' })
    const [block] = layoutBookingsOnTimeline([booking])
    expect(block.widthPercent).toBeGreaterThan(0.5)
  })

  it('preserves input order and pairs each block with its own booking', () => {
    const bookingA = makeBooking({ id: 'a', startTime: '2026-03-10T10:00:00.000Z', endTime: '2026-03-10T10:30:00.000Z' })
    const bookingB = makeBooking({ id: 'b', startTime: '2026-03-10T09:00:00.000Z', endTime: '2026-03-10T09:30:00.000Z' })
    const blocks = layoutBookingsOnTimeline([bookingA, bookingB])
    expect(blocks.map((block) => block.booking.id)).toEqual(['a', 'b'])
  })
})

describe('groupTimelineBlocksByMaster', () => {
  const masterOne = makeMaster({ id: 'master-1', name: 'Anna' })
  const masterTwo = makeMaster({ id: 'master-2', name: 'Boris' })

  it('puts overlapping bookings of two different masters into two separate rows, not one', () => {
    // Same time window, two different masters — this is exactly the overlap scenario that
    // broke the single shared-track layout (13:45-15:45 vs 14:00-15:00, see backlog feedback).
    const bookingA = makeBooking({
      id: 'a',
      masterId: 'master-1',
      startTime: '2026-03-10T13:45:00.000Z',
      endTime: '2026-03-10T15:45:00.000Z',
    })
    const bookingB = makeBooking({
      id: 'b',
      masterId: 'master-2',
      startTime: '2026-03-10T14:00:00.000Z',
      endTime: '2026-03-10T15:00:00.000Z',
    })

    const rows = groupTimelineBlocksByMaster([bookingA, bookingB], [masterOne, masterTwo])

    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.masterId === 'master-1')!.blocks.map((b) => b.booking.id)).toEqual(['a'])
    expect(rows.find((row) => row.masterId === 'master-2')!.blocks.map((b) => b.booking.id)).toEqual(['b'])
  })

  it('groups multiple bookings of the same master into a single row', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const bookingB = makeBooking({ id: 'b', masterId: 'master-1', startTime: '2026-03-10T16:00:00.000Z', endTime: '2026-03-10T17:00:00.000Z' })

    const rows = groupTimelineBlocksByMaster([bookingA, bookingB], [masterOne])

    expect(rows).toHaveLength(1)
    expect(rows[0].blocks.map((b) => b.booking.id)).toEqual(['a', 'b'])
  })

  it('creates a row only for masters who actually have a booking, not the full staff list', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne, masterTwo])
    expect(rows.map((row) => row.masterId)).toEqual(['master-1'])
  })

  it('resolves the master name from the masters list', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-2' })
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne, masterTwo])
    expect(rows[0].masterName).toBe('Boris')
  })

  it('falls back to a friendly placeholder when the master is not in the given list', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-unknown' })
    const rows = groupTimelineBlocksByMaster([bookingA], [])
    expect(rows[0].masterName).toBe('Мастер не найден')
  })

  it('sorts rows by master name', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-2' })
    const bookingB = makeBooking({ id: 'b', masterId: 'master-1' })
    const rows = groupTimelineBlocksByMaster([bookingA, bookingB], [masterOne, masterTwo])
    expect(rows.map((row) => row.masterName)).toEqual(['Anna', 'Boris'])
  })

  it('returns an empty array for an empty bookings list', () => {
    expect(groupTimelineBlocksByMaster([], [masterOne])).toEqual([])
  })

  it('creates a row for a master who only has a time block and no bookings', () => {
    const block = makeMasterBlock({ masterId: 'master-2' })
    const rows = groupTimelineBlocksByMaster([], [masterOne, masterTwo], [block])
    expect(rows).toHaveLength(1)
    expect(rows[0].masterId).toBe('master-2')
    expect(rows[0].blocks).toEqual([])
    expect(rows[0].unavailableBlocks.map((b) => b.block.id)).toEqual([block.id])
  })

  it('attaches unavailable blocks to the same row as that master\'s bookings', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const block = makeMasterBlock({ id: 'block-1', masterId: 'master-1' })
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne], [block])
    expect(rows).toHaveLength(1)
    expect(rows[0].blocks.map((b) => b.booking.id)).toEqual(['a'])
    expect(rows[0].unavailableBlocks.map((b) => b.block.id)).toEqual(['block-1'])
  })

  it('defaults to no unavailable blocks when none are passed', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne])
    expect(rows[0].unavailableBlocks).toEqual([])
  })

  // item50
  it('creates a row for a master who is off today by schedule, even without bookings or blocks', () => {
    const scheduleByMasterId = new Map([['master-2', makeScheduleRecord({ masterId: 'master-2', isWorking: false, startTime: null, endTime: null })]])
    const rows = groupTimelineBlocksByMaster([], [masterOne, masterTwo], [], scheduleByMasterId)
    expect(rows).toHaveLength(1)
    expect(rows[0].masterId).toBe('master-2')
    expect(rows[0].scheduleUnavailable).toEqual([{ leftPercent: 0, widthPercent: 100 }])
  })

  it('does not create a row for a master whose schedule for today covers the full working window', () => {
    const scheduleByMasterId = new Map([['master-2', makeScheduleRecord({ masterId: 'master-2', startTime: '09:00', endTime: '19:00' })]])
    const rows = groupTimelineBlocksByMaster([], [masterOne, masterTwo], [], scheduleByMasterId)
    expect(rows).toEqual([])
  })

  it('attaches the schedule unavailability to the same row as that master\'s bookings', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const scheduleByMasterId = new Map([['master-1', makeScheduleRecord({ isWorking: false, startTime: null, endTime: null })]])
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne], [], scheduleByMasterId)
    expect(rows).toHaveLength(1)
    expect(rows[0].blocks.map((b) => b.booking.id)).toEqual(['a'])
    expect(rows[0].scheduleUnavailable).toEqual([{ leftPercent: 0, widthPercent: 100 }])
  })

  it('defaults to no schedule unavailability when none is passed', () => {
    const bookingA = makeBooking({ id: 'a', masterId: 'master-1' })
    const rows = groupTimelineBlocksByMaster([bookingA], [masterOne])
    expect(rows[0].scheduleUnavailable).toEqual([])
  })
})

describe('scheduleUnavailableSegments', () => {
  it('returns no segments when there is no record for today ("not yet configured")', () => {
    expect(scheduleUnavailableSegments(undefined)).toEqual([])
  })

  it('shades the full row for a full day off (isWorking: false)', () => {
    expect(scheduleUnavailableSegments(makeScheduleRecord({ isWorking: false, startTime: null, endTime: null }))).toEqual([
      { leftPercent: 0, widthPercent: 100 },
    ])
  })

  it('shades only the portions outside startTime/endTime for a partially available day', () => {
    // Window is 09:00-19:00 (600min); available only 11:00-17:00 -> unavailable 09:00-11:00
    // (0%..20%) and 17:00-19:00 (80%..100%).
    const segments = scheduleUnavailableSegments(makeScheduleRecord({ startTime: '11:00', endTime: '17:00' }))
    expect(segments).toEqual([
      { leftPercent: 0, widthPercent: 20 },
      { leftPercent: 80, widthPercent: 20 },
    ])
  })

  it('shades only the start of the row when the master starts late but works past the window', () => {
    const segments = scheduleUnavailableSegments(makeScheduleRecord({ startTime: '11:00', endTime: '20:00' }))
    expect(segments).toEqual([{ leftPercent: 0, widthPercent: 20 }])
  })

  it('shades only the end of the row when the master starts before the window but leaves early', () => {
    const segments = scheduleUnavailableSegments(makeScheduleRecord({ startTime: '07:00', endTime: '17:00' }))
    expect(segments).toEqual([{ leftPercent: 80, widthPercent: 20 }])
  })

  it('returns no segments for a normal working day covering the full window', () => {
    expect(scheduleUnavailableSegments(makeScheduleRecord({ startTime: '09:00', endTime: '19:00' }))).toEqual([])
  })

  it('returns no segments when the working day covers a window wider than the timeline on both sides', () => {
    expect(scheduleUnavailableSegments(makeScheduleRecord({ startTime: '07:00', endTime: '20:00' }))).toEqual([])
  })

  it('returns no segments for a working record missing startTime/endTime', () => {
    expect(scheduleUnavailableSegments(makeScheduleRecord({ startTime: null, endTime: '19:00' }))).toEqual([])
  })
})

describe('layoutMasterBlocksOnTimeline', () => {
  it('positions a block spanning the full working window at 0%..100%', () => {
    const block = makeMasterBlock({
      startTime: `2026-03-10T${String(TIMELINE_START_HOUR).padStart(2, '0')}:00:00.000Z`,
      endTime: `2026-03-10T${String(TIMELINE_END_HOUR).padStart(2, '0')}:00:00.000Z`,
    })
    const [layout] = layoutMasterBlocksOnTimeline([block])
    expect(layout.leftPercent).toBe(0)
    expect(layout.widthPercent).toBe(100)
  })

  it('clamps a block that starts before the working window to the left edge', () => {
    const block = makeMasterBlock({ startTime: '2026-03-10T00:00:00.000Z', endTime: '2026-03-10T09:30:00.000Z' })
    const [layout] = layoutMasterBlocksOnTimeline([block])
    expect(layout.leftPercent).toBe(0)
  })

  it('pairs each layout entry with its own block', () => {
    const blockA = makeMasterBlock({ id: 'a' })
    const blockB = makeMasterBlock({ id: 'b', startTime: '2026-03-10T09:00:00.000Z', endTime: '2026-03-10T09:30:00.000Z' })
    const layouts = layoutMasterBlocksOnTimeline([blockA, blockB])
    expect(layouts.map((layout) => layout.block.id)).toEqual(['a', 'b'])
  })
})

describe('truncateMasterName', () => {
  it('leaves a name of 12 characters or fewer unchanged', () => {
    expect(truncateMasterName('Anna Client')).toBe('Anna Client')
    expect(truncateMasterName('Александра И')).toBe('Александра И')
  })

  it('cuts a name longer than 12 characters down to 12 plus an ellipsis', () => {
    expect(truncateMasterName('Александра Иванова')).toBe('Александра И…')
  })
})
