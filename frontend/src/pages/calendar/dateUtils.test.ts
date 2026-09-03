import { formatOriginalTime, formatRescheduledAt, shiftIsoToDateOnly } from './dateUtils'

describe('shiftIsoToDateOnly', () => {
  it('replaces the date while keeping the time of day', () => {
    expect(shiftIsoToDateOnly('2026-03-10T14:30:00.000Z', '2026-03-12')).toBe('2026-03-12T14:30:00.000Z')
  })

  it('crosses a month boundary', () => {
    expect(shiftIsoToDateOnly('2026-03-31T09:00:00.000Z', '2026-04-01')).toBe('2026-04-01T09:00:00.000Z')
  })

  it('crosses a year boundary', () => {
    expect(shiftIsoToDateOnly('2026-12-30T09:00:00.000Z', '2027-01-02')).toBe('2027-01-02T09:00:00.000Z')
  })

  it('is a no-op when the target date matches the current date', () => {
    expect(shiftIsoToDateOnly('2026-03-10T14:30:00.000Z', '2026-03-10')).toBe('2026-03-10T14:30:00.000Z')
  })
})

describe('formatRescheduledAt', () => {
  it('returns null when there was no reschedule', () => {
    expect(formatRescheduledAt(null)).toBeNull()
  })

  it('formats a reschedule timestamp as day.month, HH:mm', () => {
    expect(formatRescheduledAt('2026-08-24T14:30:00.000Z')).toBe('перенесено 24.08, 14:30')
  })
})

describe('formatOriginalTime', () => {
  it('returns null when the booking was never rescheduled', () => {
    expect(formatOriginalTime(null, null)).toBeNull()
  })

  it('formats the original slot as day.month, HH:mm–HH:mm', () => {
    expect(formatOriginalTime('2026-08-24T14:30:00.000Z', '2026-08-24T15:00:00.000Z')).toBe(
      'перенесена с 24.08, 14:30–15:00',
    )
  })

  it('falls back to the start time only when the original end time is missing', () => {
    expect(formatOriginalTime('2026-08-24T14:30:00.000Z', null)).toBe('перенесена с 24.08, 14:30')
  })
})
