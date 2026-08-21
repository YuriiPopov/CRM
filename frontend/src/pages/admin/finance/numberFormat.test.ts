import { formatAmount } from './numberFormat'

describe('formatAmount', () => {
  it('groups thousands with a non-breaking space and uses a comma decimal separator', () => {
    expect(formatAmount(4800)).toBe('4 800,00')
  })

  it('always shows two decimal places', () => {
    expect(formatAmount(100)).toBe('100,00')
  })

  it('rounds to two decimal places', () => {
    expect(formatAmount(19.999)).toBe('20,00')
  })

  it('formats zero', () => {
    expect(formatAmount(0)).toBe('0,00')
  })
})
