import { describe, expect, it } from 'vitest'
import {
  buildBlockedDatesSet,
  buildPartialAvailabilityByDate,
  distinctYearMonths,
  findMastersBlockedOnDate,
  unavailableFractions,
} from './masterScheduleAvailability'
import type { MasterScheduleRecord } from '../../types/masterSchedule'

function record(overrides: Partial<MasterScheduleRecord>): MasterScheduleRecord {
  return {
    id: 'schedule-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    date: '2026-03-02T00:00:00.000Z',
    isWorking: true,
    startTime: '09:00',
    endTime: '18:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('distinctYearMonths', () => {
  it('returns one entry per distinct year/month, preserving first-seen order', () => {
    const dates = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-03-29']
    expect(distinctYearMonths(dates)).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    ])
  })

  it('returns an empty array for an empty input', () => {
    expect(distinctYearMonths([])).toEqual([])
  })
})

describe('buildBlockedDatesSet', () => {
  it('includes only dates explicitly marked as non-working', () => {
    const records = [
      record({ date: '2026-03-02T00:00:00.000Z', isWorking: false }),
      record({ date: '2026-03-03T00:00:00.000Z', isWorking: true }),
    ]

    const blocked = buildBlockedDatesSet(records)

    expect(blocked.has('2026-03-02')).toBe(true)
    expect(blocked.has('2026-03-03')).toBe(false)
  })

  it('returns an empty set when there are no records ("not yet configured")', () => {
    expect(buildBlockedDatesSet([]).size).toBe(0)
  })
})

describe('findMastersBlockedOnDate', () => {
  it('marks a master blocked when their schedule for the date is non-working', () => {
    const scheduleByMasterId = new Map([
      ['master-1', [record({ masterId: 'master-1', date: '2026-03-02T00:00:00.000Z', isWorking: false })]],
      ['master-2', [record({ masterId: 'master-2', date: '2026-03-02T00:00:00.000Z', isWorking: true })]],
    ])

    const blocked = findMastersBlockedOnDate(scheduleByMasterId, '2026-03-02')

    expect(blocked.has('master-1')).toBe(true)
    expect(blocked.has('master-2')).toBe(false)
  })

  it('does not block a master with no schedule record for that date ("not yet configured")', () => {
    const scheduleByMasterId = new Map([['master-1', []]])

    const blocked = findMastersBlockedOnDate(scheduleByMasterId, '2026-03-02')

    expect(blocked.has('master-1')).toBe(false)
  })
})

// item49
describe('buildPartialAvailabilityByDate', () => {
  it('includes working days with their startTime/endTime', () => {
    const records = [
      record({ date: '2026-03-02T00:00:00.000Z', isWorking: true, startTime: '14:00', endTime: '20:00' }),
    ]

    const partial = buildPartialAvailabilityByDate(records)

    expect(partial.get('2026-03-02')).toEqual({ startTime: '14:00', endTime: '20:00' })
  })

  it('excludes fully non-working days (already covered by buildBlockedDatesSet)', () => {
    const records = [record({ date: '2026-03-02T00:00:00.000Z', isWorking: false })]

    expect(buildPartialAvailabilityByDate(records).has('2026-03-02')).toBe(false)
  })

  it('excludes working days missing startTime or endTime', () => {
    const records = [
      record({ date: '2026-03-02T00:00:00.000Z', isWorking: true, startTime: null, endTime: '20:00' }),
    ]

    expect(buildPartialAvailabilityByDate(records).has('2026-03-02')).toBe(false)
  })
})

// item52 — доля считается от рабочего окна салона 09:00–19:00 (600 минут), а не от полных
// суток (см. регресс item49, где частично рабочий день выглядел как выходной).
describe('unavailableFractions', () => {
  it('computes the unavailable share of the salon window before startTime and after endTime', () => {
    expect(unavailableFractions('14:00', '18:00')).toEqual({
      topPercent: (5 / 10) * 100,
      bottomPercent: (1 / 10) * 100,
    })
  })

  it('returns 0% on both ends when the schedule exactly matches the salon window', () => {
    expect(unavailableFractions('09:00', '19:00')).toEqual({ topPercent: 0, bottomPercent: 0 })
  })

  it('returns 0% on the start side only when startTime matches the opening hour', () => {
    expect(unavailableFractions('09:00', '15:00')).toEqual({ topPercent: 0, bottomPercent: (4 / 10) * 100 })
  })

  it('returns 0% on the end side only when endTime matches the closing hour', () => {
    expect(unavailableFractions('14:00', '19:00')).toEqual({ topPercent: (5 / 10) * 100, bottomPercent: 0 })
  })

  it('clamps a schedule wider than the salon window instead of going negative on either side', () => {
    expect(unavailableFractions('06:00', '22:00')).toEqual({ topPercent: 0, bottomPercent: 0 })
  })

  it('clamps a schedule entirely after closing instead of exceeding 100% on the top side', () => {
    expect(unavailableFractions('20:00', '22:00')).toEqual({ topPercent: 100, bottomPercent: 0 })
  })
})
