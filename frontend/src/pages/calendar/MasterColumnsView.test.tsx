import { render, screen } from '@testing-library/react'
import { MasterColumnsView } from './MasterColumnsView'
import type { Booking } from '../../types/booking'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna Master',
  specializationCategoryIds: [],
  isActive: true,
  photo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('MasterColumnsView', () => {
  it('renders an avatar placeholder with the master initials next to the column header', () => {
    render(
      <MasterColumnsView
        masters={[master]}
        bookings={[]}
        unfilteredBookings={[]}
        renderBooking={() => null}
        blocksByMasterId={new Map()}
        renderBlock={() => null}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Anna Master' })).toBeInTheDocument()
    expect(screen.getByText('AM')).toBeInTheDocument()
  })

  it('renders the master photo instead of initials when one is set', () => {
    const { container } = render(
      <MasterColumnsView
        masters={[{ ...master, photo: 'data:image/png;base64,abc' }]}
        bookings={[]}
        unfilteredBookings={[]}
        renderBooking={() => null}
        blocksByMasterId={new Map()}
        renderBlock={() => null}
      />,
    )

    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,abc')
    expect(screen.queryByText('AM')).not.toBeInTheDocument()
  })

  // item48: раньше блокировки рендерились отдельным блоком перед всеми записями колонки,
  // независимо от времени — блокировка на 15:00 оказывалась выше записи на 10:00.
  it('interleaves the block and booking into one chronological list by startTime', () => {
    const booking: Booking = {
      id: 'booking-1',
      salonId: 'salon-1',
      clientId: 'client-1',
      masterId: 'master-1',
      serviceId: 'service-1',
      startTime: '2026-03-09T10:00:00.000Z',
      endTime: '2026-03-09T11:00:00.000Z',
      status: 'CREATED',
      source: 'ADMIN',
      createdAt: '2026-03-01T00:00:00.000Z',
      rescheduledAt: null,
      originalStartTime: null,
      originalEndTime: null,
    }
    const block: MasterBlock = {
      id: 'block-1',
      salonId: 'salon-1',
      masterId: 'master-1',
      startTime: '2026-03-09T15:00:00.000Z',
      endTime: '2026-03-09T16:00:00.000Z',
      reason: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      createdById: null,
    }

    render(
      <MasterColumnsView
        masters={[master]}
        bookings={[booking]}
        unfilteredBookings={[booking]}
        renderBooking={(b) => <li key={b.id}>booking-at-10</li>}
        blocksByMasterId={new Map([[master.id, [block]]])}
        renderBlock={(bl) => <li key={bl.id}>block-at-15</li>}
      />,
    )

    const items = screen.getAllByRole('listitem').map((el) => el.textContent)
    expect(items).toEqual(['booking-at-10', 'block-at-15'])
  })
})
