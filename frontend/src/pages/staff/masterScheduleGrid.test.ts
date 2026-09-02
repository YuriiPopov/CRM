import { describe, expect, it } from 'vitest'
import {
  buildDayStates,
  buildMonthDates,
  buildUpsertDays,
  daysInMonth,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  formatMonthLabel,
  shiftMonth,
} from './masterScheduleGrid'
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

describe('daysInMonth', () => {
  it('returns 31 for March 2026', () => {
    expect(daysInMonth(2026, 3)).toBe(31)
  })

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
  })

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2028, 2)).toBe(29)
  })
})

describe('buildMonthDates', () => {
  it('builds one YYYY-MM-DD string per day of the month, in order', () => {
    const dates = buildMonthDates(2026, 2)
    expect(dates).toHaveLength(28)
    expect(dates[0]).toBe('2026-02-01')
    expect(dates[27]).toBe('2026-02-28')
  })
})

describe('shiftMonth', () => {
  it('moves forward within the same year', () => {
    expect(shiftMonth(2026, 3, 1)).toEqual({ year: 2026, month: 4 })
  })

  it('rolls over to the next year', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('rolls back to the previous year', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('formatMonthLabel', () => {
  it('formats a Russian month name and year', () => {
    expect(formatMonthLabel(2026, 3)).toBe('март 2026 г.')
  })
})

describe('buildDayStates', () => {
  it('marks days without a record as unset with default hours', () => {
    const result = buildDayStates(['2026-03-01', '2026-03-02'], [])

    expect(result.get('2026-03-01')).toEqual({
      status: 'unset',
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
    })
  })

  it('marks a working day with its stored hours', () => {
    const result = buildDayStates(
      ['2026-03-02'],
      [record({ date: '2026-03-02T00:00:00.000Z', isWorking: true, startTime: '10:00', endTime: '19:00' })],
    )

    expect(result.get('2026-03-02')).toEqual({ status: 'working', startTime: '10:00', endTime: '19:00' })
  })

  it('marks a non-working day as off, ignoring any stored hours', () => {
    const result = buildDayStates(
      ['2026-03-03'],
      [record({ date: '2026-03-03T00:00:00.000Z', isWorking: false, startTime: null, endTime: null })],
    )

    expect(result.get('2026-03-03')).toEqual({
      status: 'off',
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
    })
  })
})

describe('buildUpsertDays', () => {
  it('omits unset days from the payload', () => {
    const days = buildUpsertDays(
      new Map([['2026-03-01', { status: 'unset', startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME }]]),
    )

    expect(days).toEqual([])
  })

  it('includes hours for working days and omits them for off days', () => {
    const days = buildUpsertDays(
      new Map([
        ['2026-03-02', { status: 'working', startTime: '09:00', endTime: '18:00' }],
        ['2026-03-03', { status: 'off', startTime: DEFAULT_START_TIME, endTime: DEFAULT_END_TIME }],
      ]),
    )

    expect(days).toEqual([
      { date: '2026-03-02', isWorking: true, startTime: '09:00', endTime: '18:00' },
      { date: '2026-03-03', isWorking: false },
    ])
  })
})
