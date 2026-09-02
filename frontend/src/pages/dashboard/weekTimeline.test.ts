import { getIsoWeekRange, groupBookingsByDayAndMaster } from './weekTimeline'
import type { Booking, BookingStatus } from '../../types/booking'
import type { Master } from '../../types/staff'
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
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

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

describe('getIsoWeekRange', () => {
  it('resolves Monday..Sunday for a date in the middle of the week', () => {
    // 2026-03-10 is a Tuesday
    const { start, end } = getIsoWeekRange(new Date('2026-03-10T15:30:00.000Z'))
    expect(start.toISOString()).toBe('2026-03-09T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-15T23:59:59.999Z')
  })

  it('keeps the same week when the reference date is already Monday', () => {
    const { start, end } = getIsoWeekRange(new Date('2026-03-09T00:00:00.000Z'))
    expect(start.toISOString()).toBe('2026-03-09T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-15T23:59:59.999Z')
  })

  it('keeps the same week when the reference date is Sunday', () => {
    const { start, end } = getIsoWeekRange(new Date('2026-03-15T23:00:00.000Z'))
    expect(start.toISOString()).toBe('2026-03-09T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-15T23:59:59.999Z')
  })

  it('handles a week that crosses a month boundary', () => {
    const { start, end } = getIsoWeekRange(new Date('2026-03-01T12:00:00.000Z'))
    expect(start.toISOString()).toBe('2026-02-23T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-01T23:59:59.999Z')
  })

  it('handles the first week of the year', () => {
    // 2026-01-01 is a Thursday, so its ISO week starts on Monday 2025-12-29
    const { start, end } = getIsoWeekRange(new Date('2026-01-01T09:00:00.000Z'))
    expect(start.toISOString()).toBe('2025-12-29T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-04T23:59:59.999Z')
  })
})

describe('groupBookingsByDayAndMaster', () => {
  const masterOne = makeMaster({ id: 'master-1', name: 'Anna' })
  const masterTwo = makeMaster({ id: 'master-2', name: 'Boris' })
  const monday = new Date('2026-03-09T00:00:00.000Z')

  it('returns exactly 7 columns, one per day of the week, in Monday..Sunday order', () => {
    const columns = groupBookingsByDayAndMaster([], [], monday)
    expect(columns.map((c) => c.date)).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ])
  })

  it('puts a booking into the column matching its start date', () => {
    const booking = makeBooking({ id: 'a', startTime: '2026-03-11T10:00:00.000Z', endTime: '2026-03-11T11:00:00.000Z' })
    const columns = groupBookingsByDayAndMaster([booking], [masterOne], monday)
    expect(columns.find((c) => c.date === '2026-03-11')!.bars.map((b) => b.booking.id)).toEqual(['a'])
    expect(columns.filter((c) => c.date !== '2026-03-11').every((c) => c.bars.length === 0)).toBe(true)
  })

  it('groups bookings of the same master next to each other within a day, sorted by master name', () => {
    const bookingBoris = makeBooking({
      id: 'boris-1',
      masterId: 'master-2',
      startTime: '2026-03-10T09:00:00.000Z',
      endTime: '2026-03-10T09:30:00.000Z',
    })
    const bookingAnnaLate = makeBooking({
      id: 'anna-2',
      masterId: 'master-1',
      startTime: '2026-03-10T15:00:00.000Z',
      endTime: '2026-03-10T15:30:00.000Z',
    })
    const bookingAnnaEarly = makeBooking({
      id: 'anna-1',
      masterId: 'master-1',
      startTime: '2026-03-10T10:00:00.000Z',
      endTime: '2026-03-10T10:30:00.000Z',
    })

    const columns = groupBookingsByDayAndMaster(
      [bookingBoris, bookingAnnaLate, bookingAnnaEarly],
      [masterOne, masterTwo],
      monday,
    )

    const day = columns.find((c) => c.date === '2026-03-10')!
    expect(day.bars.map((b) => b.booking.id)).toEqual(['anna-1', 'anna-2', 'boris-1'])
  })

  it('excludes CANCELLED bookings, reusing the same active-status filter as the day timeline', () => {
    const cancelled = makeBooking({ id: 'cancelled', status: 'CANCELLED' as BookingStatus, startTime: '2026-03-10T10:00:00.000Z' })
    const active = makeBooking({ id: 'active', status: 'CREATED', startTime: '2026-03-10T10:00:00.000Z' })
    const columns = groupBookingsByDayAndMaster([cancelled, active], [masterOne], monday)
    expect(columns.find((c) => c.date === '2026-03-10')!.bars.map((b) => b.booking.id)).toEqual(['active'])
  })

  it('ignores bookings outside the given week', () => {
    const before = makeBooking({ id: 'before', startTime: '2026-03-08T10:00:00.000Z', endTime: '2026-03-08T11:00:00.000Z' })
    const after = makeBooking({ id: 'after', startTime: '2026-03-16T10:00:00.000Z', endTime: '2026-03-16T11:00:00.000Z' })
    const columns = groupBookingsByDayAndMaster([before, after], [masterOne], monday)
    expect(columns.every((c) => c.bars.length === 0)).toBe(true)
  })

  it('falls back to a friendly placeholder when the master is not in the given list', () => {
    const booking = makeBooking({ id: 'a', masterId: 'master-unknown', startTime: '2026-03-10T10:00:00.000Z' })
    const columns = groupBookingsByDayAndMaster([booking], [], monday)
    expect(columns.find((c) => c.date === '2026-03-10')!.bars[0].masterName).toBe('Мастер не найден')
  })

  it('marks the column matching todayIso as isToday and no other column', () => {
    const columns = groupBookingsByDayAndMaster([], [], monday, [], '2026-03-11T08:00:00.000Z')
    expect(columns.find((c) => c.isToday)?.date).toBe('2026-03-11')
    expect(columns.filter((c) => c.isToday)).toHaveLength(1)
  })

  it('marks no column as isToday when today falls outside the displayed week', () => {
    const columns = groupBookingsByDayAndMaster([], [], monday, [], '2026-04-01T08:00:00.000Z')
    expect(columns.some((c) => c.isToday)).toBe(false)
  })

  it('attaches a master time block to the day column it falls on', () => {
    const block = makeMasterBlock({ masterId: 'master-1', startTime: '2026-03-12T10:00:00.000Z', endTime: '2026-03-12T11:00:00.000Z' })
    const columns = groupBookingsByDayAndMaster([], [masterOne], monday, [block])
    expect(columns.find((c) => c.date === '2026-03-12')!.unavailableBars.map((b) => b.block.id)).toEqual([block.id])
    expect(columns.filter((c) => c.date !== '2026-03-12').every((c) => c.unavailableBars.length === 0)).toBe(true)
  })

  it('spreads a multi-day master block across every day it overlaps', () => {
    const block = makeMasterBlock({
      id: 'vacation',
      masterId: 'master-1',
      startTime: '2026-03-11T00:00:00.000Z',
      endTime: '2026-03-13T23:59:59.999Z',
    })
    const columns = groupBookingsByDayAndMaster([], [masterOne], monday, [block])
    const daysWithBlock = columns.filter((c) => c.unavailableBars.length > 0).map((c) => c.date)
    expect(daysWithBlock).toEqual(['2026-03-11', '2026-03-12', '2026-03-13'])
  })

  it('defaults to no unavailable bars when no master blocks are passed', () => {
    const columns = groupBookingsByDayAndMaster([], [masterOne], monday)
    expect(columns.every((c) => c.unavailableBars.length === 0)).toBe(true)
  })
})
