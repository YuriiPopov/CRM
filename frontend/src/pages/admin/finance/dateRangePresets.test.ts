import { presetRange, toInclusiveEndOfDayIso, validateRange } from './dateRangePresets'

// "Сегодня" зафиксирован как среда, чтобы неделя/месяц считались предсказуемо.
const TODAY = '2026-03-11'

describe('presetRange', () => {
  it('today: from and to are both today', () => {
    expect(presetRange('today', TODAY)).toEqual({ from: '2026-03-11', to: '2026-03-11' })
  })

  it('thisWeek: from Monday of the current week through today', () => {
    expect(presetRange('thisWeek', TODAY)).toEqual({ from: '2026-03-09', to: '2026-03-11' })
  })

  it('thisWeek: when today is Monday, the range collapses to a single day', () => {
    expect(presetRange('thisWeek', '2026-03-09')).toEqual({ from: '2026-03-09', to: '2026-03-09' })
  })

  it('thisMonth: from the 1st of the month through today', () => {
    expect(presetRange('thisMonth', TODAY)).toEqual({ from: '2026-03-01', to: '2026-03-11' })
  })

  it('lastMonth: the full previous calendar month', () => {
    expect(presetRange('lastMonth', TODAY)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('lastMonth: rolls back across a year boundary', () => {
    expect(presetRange('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('lastMonth: handles a leap-year February', () => {
    expect(presetRange('lastMonth', '2028-03-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('validateRange', () => {
  it('accepts a well-formed past-or-present range', () => {
    expect(validateRange({ from: '2026-03-01', to: '2026-03-11' }, TODAY)).toBeNull()
  })

  it('accepts a range that ends exactly today', () => {
    expect(validateRange({ from: TODAY, to: TODAY }, TODAY)).toBeNull()
  })

  it('rejects an empty "from" or "to"', () => {
    expect(validateRange({ from: '', to: '2026-03-11' }, TODAY)).toMatch(/укажите обе даты/i)
    expect(validateRange({ from: '2026-03-01', to: '' }, TODAY)).toMatch(/укажите обе даты/i)
  })

  it('rejects "from" after "to"', () => {
    expect(validateRange({ from: '2026-03-11', to: '2026-03-01' }, TODAY)).toMatch(/позже/i)
  })

  it('rejects a range that extends into the future', () => {
    expect(validateRange({ from: '2026-03-01', to: '2026-03-12' }, TODAY)).toMatch(/будущее/i)
  })
})

describe('toInclusiveEndOfDayIso', () => {
  it('appends the end-of-day time so the whole day is covered', () => {
    expect(toInclusiveEndOfDayIso('2026-03-11')).toBe('2026-03-11T23:59:59.999Z')
  })
})
