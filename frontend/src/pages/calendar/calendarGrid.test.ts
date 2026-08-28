import { getMonthGridDays, getWeekGridDays, navigateGridAnchor } from './calendarGrid'

describe('getWeekGridDays', () => {
  it('returns exactly 7 days starting on the Monday of the anchor week', () => {
    const days = getWeekGridDays('2026-03-12') // Thursday
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe('2026-03-09') // Monday
    expect(days[6].date).toBe('2026-03-15') // Sunday
  })

  it('marks every day as the current period', () => {
    const days = getWeekGridDays('2026-03-12')
    expect(days.every((day) => day.isCurrentPeriod)).toBe(true)
  })

  it('flags today based on the given reference date', () => {
    const days = getWeekGridDays('2026-03-12', '2026-03-11T08:00:00.000Z')
    expect(days.find((day) => day.isToday)?.date).toBe('2026-03-11')
  })

  it('flags no day as today when today falls outside the week', () => {
    const days = getWeekGridDays('2026-03-12', '2026-04-01T08:00:00.000Z')
    expect(days.some((day) => day.isToday)).toBe(false)
  })
})

describe('getMonthGridDays', () => {
  it('returns exactly 42 days (6 weeks)', () => {
    expect(getMonthGridDays('2026-03-15')).toHaveLength(42)
  })

  // 1-е число месяца перебирает все 7 дней недели — сетка всегда должна стартовать с
  // понедельника, включая случай, когда 1-е само уже понедельник.
  it.each([
    ['2025-01-15', '2024-12-30'], // 1 Jan 2025 = Wed
    ['2025-02-15', '2025-01-27'], // 1 Feb 2025 = Sat
    ['2025-04-15', '2025-03-31'], // 1 Apr 2025 = Tue
    ['2025-05-15', '2025-04-28'], // 1 May 2025 = Thu
    ['2025-06-15', '2025-05-26'], // 1 Jun 2025 = Sun
    ['2025-08-15', '2025-07-28'], // 1 Aug 2025 = Fri
    ['2025-09-15', '2025-09-01'], // 1 Sep 2025 = Mon
  ])('starts on a Monday for anchor month %s', (anchor, expectedStart) => {
    const days = getMonthGridDays(anchor)
    expect(days[0].date).toBe(expectedStart)
  })

  it('marks days outside the anchor month as not current period', () => {
    const days = getMonthGridDays('2026-03-15')
    expect(days[0].isCurrentPeriod).toBe(false) // late Feb, fills the grid
    expect(days.find((day) => day.date === '2026-03-15')?.isCurrentPeriod).toBe(true)
  })

  it('flags today based on the given reference date', () => {
    const days = getMonthGridDays('2026-03-15', '2026-03-20T08:00:00.000Z')
    expect(days.find((day) => day.isToday)?.date).toBe('2026-03-20')
  })
})

describe('navigateGridAnchor', () => {
  it('moves the week anchor by exactly 7 days forward', () => {
    expect(navigateGridAnchor('2026-03-10', 'week', 1)).toBe('2026-03-17')
  })

  it('moves the week anchor by exactly 7 days backward', () => {
    expect(navigateGridAnchor('2026-03-10', 'week', -1)).toBe('2026-03-03')
  })

  it('crosses a year boundary when navigating by week', () => {
    expect(navigateGridAnchor('2025-12-29', 'week', 1)).toBe('2026-01-05')
  })

  it('always lands on the 1st when navigating by month, even from a high day-of-month', () => {
    expect(navigateGridAnchor('2026-01-31', 'month', 1)).toBe('2026-02-01')
  })

  it('navigates a month backward across a year boundary', () => {
    expect(navigateGridAnchor('2026-01-15', 'month', -1)).toBe('2025-12-01')
  })
})
