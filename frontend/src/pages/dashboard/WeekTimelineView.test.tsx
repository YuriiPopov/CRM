import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekTimelineView } from './WeekTimelineView'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'

function makeBooking(overrides: Partial<Booking>): Booking {
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
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  }
}

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specializationCategoryIds: ['category-spa'],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

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

function renderTimeline(bookings: Booking[] = []) {
  return render(
    <WeekTimelineView
      bookings={bookings}
      masters={[master]}
      masterBlocks={[]}
      clients={[client]}
      services={[service]}
      isAdmin
    />,
  )
}

describe('WeekTimelineView', () => {
  beforeEach(() => {
    // 2026-03-10 is a Tuesday in the 2026-03-09..2026-03-15 ISO week.
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders exactly 7 day columns', () => {
    renderTimeline()
    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    expect(grid.querySelectorAll('.dashboard-week-day')).toHaveLength(7)
  })

  it('highlights today’s column on initial render', () => {
    renderTimeline()
    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    expect(grid.querySelectorAll('.dashboard-week-day-today')).toHaveLength(1)
  })

  it('places a booking in the column of its own day, grouped by master as a fixed-size bar', () => {
    renderTimeline([makeBooking({ id: 'a', startTime: '2026-03-10T10:00:00.000Z', endTime: '2026-03-10T11:00:00.000Z' })])
    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    expect(grid.querySelectorAll('.dashboard-week-bar')).toHaveLength(1)
  })

  it('marks a rescheduled booking\'s bar, showing the original time as the main detail and the reschedule moment as secondary in the tooltip', () => {
    renderTimeline([
      makeBooking({
        id: 'a',
        originalStartTime: '2026-03-10T08:00:00.000Z',
        originalEndTime: '2026-03-10T08:30:00.000Z',
        rescheduledAt: '2026-03-10T09:00:00.000Z',
      }),
    ])
    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    const bar = grid.querySelector('.dashboard-week-bar')!
    expect(bar).toHaveClass('dashboard-week-bar--rescheduled')
    expect(bar).toHaveAttribute('title', expect.stringContaining('перенесена с'))
    expect(bar).toHaveAttribute('title', expect.stringContaining('перенесено'))
  })

  it('does not mark the bar for a booking that was never rescheduled', () => {
    renderTimeline([makeBooking({ id: 'a', originalStartTime: null, originalEndTime: null, rescheduledAt: null })])
    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    const bar = grid.querySelector('.dashboard-week-bar')!
    expect(bar).not.toHaveClass('dashboard-week-bar--rescheduled')
    expect(bar).not.toHaveAttribute('title', expect.stringContaining('перенесено'))
  })

  it('removes the today highlight after navigating to the next week, and no column becomes today instead', async () => {
    const user = userEvent.setup()
    renderTimeline()

    await user.click(screen.getByRole('button', { name: /следующая неделя/i }))

    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    expect(grid.querySelectorAll('.dashboard-week-day-today')).toHaveLength(0)
  })

  it('restores the today highlight after navigating forward and back', async () => {
    const user = userEvent.setup()
    renderTimeline()

    await user.click(screen.getByRole('button', { name: /следующая неделя/i }))
    await user.click(screen.getByRole('button', { name: /предыдущая неделя/i }))

    const grid = screen.getByRole('img', { name: /таймлайн загрузки мастеров по неделе/i })
    expect(grid.querySelectorAll('.dashboard-week-day-today')).toHaveLength(1)
  })

  it('changes the visible week label when navigating with the arrows', async () => {
    const user = userEvent.setup()
    renderTimeline()

    const labelBefore = document.querySelector('.dashboard-week-timeline-label')!.textContent

    await user.click(screen.getByRole('button', { name: /следующая неделя/i }))

    const labelAfter = document.querySelector('.dashboard-week-timeline-label')!.textContent
    expect(labelAfter).not.toBe(labelBefore)
  })
})
