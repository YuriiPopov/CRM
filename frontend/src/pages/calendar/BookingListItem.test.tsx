import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingListItem } from './BookingListItem'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

const client: Client = {
  id: 'client-1',
  salonId: 'salon-1',
  name: 'Anna Client',
  phone: '+48111222333',
  email: null,
  notes: null,
  tags: [],
  consentGivenAt: '2026-01-01T00:00:00.000Z',
  consentWithdrawnAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const service: Service = {
  id: 'service-1',
  salonId: 'salon-1',
  name: 'Massage',
  category: 'MASSAGE',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specialization: 'MASSAGE',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    salonId: 'salon-1',
    clientId: 'client-1',
    masterId: 'master-1',
    serviceId: 'service-1',
    startTime: '2026-01-10T10:00:00.000Z',
    endTime: '2026-01-10T11:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-01-10T09:00:00.000Z',
    ...overrides,
  }
}

const noop = () => {}

describe('BookingListItem', () => {
  // Регрессия item17: "Моё расписание" (роль MASTER) не грузит полный список мастеров
  // (Backlog п.5), поэтому master приходит undefined — раньше это давало fallback
  // 'Мастер не найден' независимо от статуса записи.
  it('shows "Это вы" for MASTER viewing their own booking instead of "Мастер не найден"', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ masterId: 'master-1' })}
          client={client}
          master={undefined}
          service={service}
          role="MASTER"
          currentMasterId="master-1"
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Мастер не найден')).not.toBeInTheDocument()
    expect(screen.getByText('Это вы')).toBeInTheDocument()
  })

  it('shows the master name for ADMIN screens where master is resolved', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ masterId: 'master-1' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.queryByText('Это вы')).not.toBeInTheDocument()
  })

  it('shows no master label at all when master is unresolved and it is not the viewer\'s own booking (no "не найден" wording)', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ masterId: 'master-2' })}
          client={client}
          master={undefined}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Мастер не найден')).not.toBeInTheDocument()
    expect(screen.queryByText('Это вы')).not.toBeInTheDocument()
  })
})
