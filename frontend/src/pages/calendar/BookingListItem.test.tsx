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
  categoryId: 'category-massage',
  durationMin: 60,
  price: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specializationCategoryIds: ['category-massage'],
  isActive: true,
  photo: null,
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
    rescheduledAt: null,
    originalStartTime: null,
    originalEndTime: null,
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
          groupedByMaster={false}
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
          groupedByMaster={false}
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
          groupedByMaster={false}
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

  it('shows the original time as the main reschedule detail, with the reschedule moment as a secondary tooltip', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({
            originalStartTime: '2026-08-24T13:00:00.000Z',
            originalEndTime: '2026-08-24T13:30:00.000Z',
            rescheduledAt: '2026-08-24T14:30:00.000Z',
          })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          groupedByMaster={false}
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    const label = screen.getByText('перенесена с 24.08, 13:00–13:30')
    expect(label).toBeInTheDocument()
    expect(label).toHaveAttribute('title', 'перенесено 24.08, 14:30')
    expect(screen.queryByText(/перенесено/)).not.toBeInTheDocument()
  })

  it('shows no reschedule mark when the booking was never rescheduled', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ originalStartTime: null, originalEndTime: null, rescheduledAt: null })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          groupedByMaster={false}
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText(/перенес/)).not.toBeInTheDocument()
  })

  it('shows the service name in bold and the client name as plain text', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          groupedByMaster={false}
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.getByText('Massage').tagName).toBe('STRONG')
    expect(screen.getByText('Anna Client').tagName).toBe('SPAN')
  })

  it('hides the master name when grouped by master (column header already shows it)', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ masterId: 'master-1' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          groupedByMaster
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Anna')).not.toBeInTheDocument()
  })

  it('hides "Это вы" for MASTER on their own booking when grouped by master', () => {
    render(
      <ul>
        <BookingListItem
          booking={booking({ masterId: 'master-1' })}
          client={client}
          master={undefined}
          service={service}
          role="MASTER"
          currentMasterId="master-1"
          groupedByMaster
          isPaid={false}
          canCreatePayment={false}
          onStatusChange={vi.fn()}
          onReschedule={noop}
          onCreatePayment={noop}
          busy={false}
        />
      </ul>,
    )

    expect(screen.queryByText('Это вы')).not.toBeInTheDocument()
  })
})
