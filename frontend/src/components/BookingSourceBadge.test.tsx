import { render, screen } from '@testing-library/react'
import { BookingSourceBadge } from './BookingSourceBadge'

describe('BookingSourceBadge', () => {
  it('renders a phone icon with an "Из приложения" tooltip for an ONLINE booking', () => {
    render(<BookingSourceBadge source="ONLINE" />)

    const badge = screen.getByRole('img', { name: 'Из приложения' })
    expect(badge).toHaveAttribute('title', 'Из приложения')
    expect(badge.querySelector('svg')).not.toBeNull()
  })

  it('renders nothing for a booking created in the CRM', () => {
    const { container } = render(<BookingSourceBadge source="ADMIN" />)

    expect(container).toBeEmptyDOMElement()
  })
})
