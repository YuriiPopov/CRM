import { render, screen } from '@testing-library/react'
import { MasterColumnsView } from './MasterColumnsView'
import type { Master } from '../../types/staff'

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
})
