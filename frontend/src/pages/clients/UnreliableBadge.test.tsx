import { render, screen } from '@testing-library/react'
import { isUnreliableClient, UnreliableBadge } from './UnreliableBadge'

describe('UnreliableBadge (item74)', () => {
  it('renders nothing for a client with 2 no-shows', () => {
    const { container } = render(<UnreliableBadge client={{ noShowCount: 2, unreliable: false }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders 🚩 for a client with 3 no-shows, with the count in the tooltip', () => {
    render(<UnreliableBadge client={{ noShowCount: 3, unreliable: true }} />)
    const badge = screen.getByText('🚩 Ненадёжный')
    expect(badge).toHaveAttribute('title', 'Неявок: 3')
  })

  it('treats a client without the backend flag (e.g. just created) as reliable', () => {
    expect(isUnreliableClient({})).toBe(false)
  })
})
