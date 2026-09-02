import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingGridCard } from './BookingGridCard'
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
  consentGivenAt: null,
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
  name: 'Anna Master',
  specializationCategoryIds: ['category-massage'],
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
    startTime: '2026-03-10T10:00:00.000Z',
    endTime: '2026-03-10T11:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    ...overrides,
  }
}

const noop = () => {}

describe('BookingGridCard', () => {
  it('renders time and the status badge for both roles', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByText('Создана')).toBeInTheDocument()
  })

  it('for ADMIN: shows service and master, not the client, in the card body', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByText('Massage')).toBeInTheDocument()
    expect(screen.getByText('Anna Master')).toBeInTheDocument()
    expect(screen.queryByText('Anna Client')).not.toBeInTheDocument()
  })

  it('for ADMIN: still surfaces the client in the title tooltip', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveAttribute('title', expect.stringContaining('Anna Client'))
  })

  it('for ADMIN: omits the master line instead of showing a "not found" fallback when master is unresolved', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={undefined}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.queryByText(/мастер не найден/i)).not.toBeInTheDocument()
  })

  it('for MASTER: shows client and service in the card body, not the master name', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ masterId: 'master-other' })}
          client={client}
          master={master}
          service={service}
          role="MASTER"
          currentMasterId="master-other"
          isPaid={false}
          canDragReschedule={false}
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByText('Anna Client')).toBeInTheDocument()
    expect(screen.getByText('Massage')).toBeInTheDocument()
    expect(screen.queryByText('Anna Master')).not.toBeInTheDocument()
  })

  it('for MASTER: shows "Это вы" on their own booking', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ masterId: 'master-1' })}
          client={client}
          master={master}
          service={service}
          role="MASTER"
          currentMasterId="master-1"
          isPaid={false}
          canDragReschedule={false}
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByText('Это вы')).toBeInTheDocument()
  })

  it('for MASTER: does not show "Это вы" on a booking that is not their own', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ masterId: 'master-other' })}
          client={client}
          master={master}
          service={service}
          role="MASTER"
          currentMasterId="master-1"
          isPaid={false}
          canDragReschedule={false}
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.queryByText('Это вы')).not.toBeInTheDocument()
  })

  it('is draggable for ADMIN when the booking can be rescheduled', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ status: 'CREATED' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'true')
  })

  it('is not draggable when canDragReschedule is false, even for ADMIN', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ status: 'CREATED' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule={false}
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false')
  })

  it('is not draggable for a COMPLETED booking, even with canDragReschedule true', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ status: 'COMPLETED' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false')
  })

  it('hides the "Перенести" button when canDragReschedule is false (MASTER, read-only grid)', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="MASTER"
          currentMasterId="master-1"
          isPaid={false}
          canDragReschedule={false}
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: /перенести/i })).not.toBeInTheDocument()
  })

  it('calls onReschedule when the "Перенести" button is clicked', async () => {
    const onReschedule = vi.fn()
    const user = userEvent.setup()
    render(
      <ul>
        <BookingGridCard
          booking={booking({})}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={onReschedule}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    await user.click(screen.getByRole('button', { name: /перенести/i }))
    expect(onReschedule).toHaveBeenCalled()
  })

  it('shows the reschedule mark when the booking was rescheduled', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ rescheduledAt: '2026-08-24T14:30:00.000Z' })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.getByText('перенесено 24.08, 14:30')).toBeInTheDocument()
  })

  it('shows no reschedule mark when the booking was never rescheduled', () => {
    render(
      <ul>
        <BookingGridCard
          booking={booking({ rescheduledAt: null })}
          client={client}
          master={master}
          service={service}
          role="ADMIN"
          currentMasterId={null}
          isPaid={false}
          canDragReschedule
          isDragging={false}
          busy={false}
          onReschedule={noop}
          onDragStart={noop}
          onDragEnd={noop}
        />
      </ul>,
    )

    expect(screen.queryByText(/перенесено/)).not.toBeInTheDocument()
  })
})
