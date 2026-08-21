import { canReschedule, getAvailableStatusActions } from './statusTransitions'

describe('getAvailableStatusActions', () => {
  describe('ADMIN', () => {
    it('offers CONFIRMED and CANCELLED from CREATED', () => {
      expect(getAvailableStatusActions('CREATED', 'ADMIN')).toEqual(['CONFIRMED', 'CANCELLED'])
    })

    it('offers COMPLETED and CANCELLED from CONFIRMED', () => {
      expect(getAvailableStatusActions('CONFIRMED', 'ADMIN')).toEqual(['COMPLETED', 'CANCELLED'])
    })

    it('offers nothing from the terminal COMPLETED state', () => {
      expect(getAvailableStatusActions('COMPLETED', 'ADMIN')).toEqual([])
    })

    it('offers nothing from the terminal CANCELLED state', () => {
      expect(getAvailableStatusActions('CANCELLED', 'ADMIN')).toEqual([])
    })
  })

  describe('MASTER', () => {
    it('can only cancel from CREATED — confirming stays an ADMIN action', () => {
      expect(getAvailableStatusActions('CREATED', 'MASTER')).toEqual(['CANCELLED'])
    })

    it('can complete or cancel from CONFIRMED', () => {
      expect(getAvailableStatusActions('CONFIRMED', 'MASTER')).toEqual(['COMPLETED', 'CANCELLED'])
    })

    it('offers nothing from either terminal state', () => {
      expect(getAvailableStatusActions('COMPLETED', 'MASTER')).toEqual([])
      expect(getAvailableStatusActions('CANCELLED', 'MASTER')).toEqual([])
    })
  })
})

describe('canReschedule', () => {
  it.each(['CREATED', 'CONFIRMED'] as const)('allows ADMIN to reschedule a %s booking', (status) => {
    expect(canReschedule(status, 'ADMIN')).toBe(true)
  })

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'never allows rescheduling a terminal %s booking, even for ADMIN',
    (status) => {
      expect(canReschedule(status, 'ADMIN')).toBe(false)
    },
  )

  it.each(['CREATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const)(
    'never allows MASTER to reschedule (status: %s)',
    (status) => {
      expect(canReschedule(status, 'MASTER')).toBe(false)
    },
  )
})
