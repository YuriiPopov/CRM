import {
  canReschedule,
  getAvailableStatusActions,
  getStatusBadgeClass,
  STATUS_ACTION_LABELS,
  STATUS_LABELS,
} from './statusTransitions'

describe('getAvailableStatusActions', () => {
  describe('ADMIN', () => {
    it('offers CONFIRMED and CANCELLED from CREATED', () => {
      expect(getAvailableStatusActions('CREATED', 'ADMIN')).toEqual(['CONFIRMED', 'CANCELLED'])
    })

    it('offers COMPLETED and CANCELLED from CONFIRMED', () => {
      expect(getAvailableStatusActions('CONFIRMED', 'ADMIN')).toEqual(['COMPLETED', 'CANCELLED'])
    })

    // item74 — «Не пришёл» только после начала визита
    describe('NO_SHOW', () => {
      const now = Date.parse('2026-10-04T12:00:00.000Z')

      it('offers NO_SHOW from CONFIRMED once the start time has passed', () => {
        expect(getAvailableStatusActions('CONFIRMED', 'ADMIN', '2026-10-04T11:00:00.000Z', now)).toEqual([
          'COMPLETED',
          'CANCELLED',
          'NO_SHOW',
        ])
      })

      it('offers NO_SHOW exactly at the start time', () => {
        expect(getAvailableStatusActions('CONFIRMED', 'ADMIN', '2026-10-04T12:00:00.000Z', now)).toContain(
          'NO_SHOW',
        )
      })

      it('hides NO_SHOW for a booking that has not started yet', () => {
        expect(getAvailableStatusActions('CONFIRMED', 'ADMIN', '2026-10-04T13:00:00.000Z', now)).not.toContain(
          'NO_SHOW',
        )
      })

      it('never offers NO_SHOW from CREATED', () => {
        expect(getAvailableStatusActions('CREATED', 'ADMIN', '2026-10-04T11:00:00.000Z', now)).not.toContain(
          'NO_SHOW',
        )
      })

      it('offers nothing from the terminal NO_SHOW state', () => {
        expect(getAvailableStatusActions('NO_SHOW', 'ADMIN', '2026-10-04T11:00:00.000Z', now)).toEqual([])
      })

      it('never offers NO_SHOW to MASTER', () => {
        expect(getAvailableStatusActions('CONFIRMED', 'MASTER', '2026-10-04T11:00:00.000Z', now)).toEqual([
          'COMPLETED',
          'CANCELLED',
        ])
      })
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

  it.each(['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const)(
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

describe('getStatusBadgeClass', () => {
  it.each([
    ['CREATED', 'status-badge-created'],
    ['CONFIRMED', 'status-badge-confirmed'],
    ['COMPLETED', 'status-badge-completed'],
    ['CANCELLED', 'status-badge-cancelled'],
    ['NO_SHOW', 'status-badge-no-show'],
  ] as const)('maps %s to %s', (status, expectedClass) => {
    expect(getStatusBadgeClass(status)).toBe(expectedClass)
  })

  it('returns a distinct class for every status (no accidental overlap)', () => {
    const statuses = ['CREATED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const
    const classes = new Set(statuses.map((status) => getStatusBadgeClass(status)))
    expect(classes.size).toBe(statuses.length)
  })
})

describe('NO_SHOW labels (item74)', () => {
  it('is labelled «Не пришёл» both as a status and as an action', () => {
    expect(STATUS_LABELS.NO_SHOW).toBe('Не пришёл')
    expect(STATUS_ACTION_LABELS.NO_SHOW).toBe('Не пришёл')
  })
})
