import { fireEvent, render, screen, within } from '@testing-library/react'
import { CalendarGridView } from './CalendarGridView'
import { getMonthGridDays, getWeekGridDays } from './calendarGrid'
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
    startTime: '2026-03-09T10:00:00.000Z',
    endTime: '2026-03-09T11:00:00.000Z',
    status: 'CREATED',
    source: 'ADMIN',
    createdAt: '2026-03-01T00:00:00.000Z',
    rescheduledAt: null,
    ...overrides,
  }
}

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

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specializationCategoryIds: ['category-massage'],
  isActive: true,
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

// jsdom's DragEvent has no working dataTransfer — fireEvent lets us hand it a stand-in object,
// the standard RTL workaround for native HTML5 DnD (see @testing-library/user-event's own docs:
// it doesn't fully support DnD either).
function makeDataTransfer() {
  return { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '' }
}

function getCell(dateOnly: string): HTMLElement {
  return document.querySelector(`[data-date="${dateOnly}"]`) as HTMLElement
}

const noop = () => {}

describe('CalendarGridView', () => {
  it('renders exactly 7 cells for the week layout', () => {
    render(
      <CalendarGridView
        days={getWeekGridDays('2026-03-12')}
        layout="week"
        bookingsByDay={new Map()}
        blocksByDay={new Map()}
        clientsById={new Map()}
        mastersById={new Map()}
        servicesById={new Map()}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={noop}
      />,
    )
    expect(document.querySelectorAll('.calendar-grid-cell')).toHaveLength(7)
  })

  it('renders exactly 42 cells for the month layout', () => {
    render(
      <CalendarGridView
        days={getMonthGridDays('2026-03-15')}
        layout="month"
        bookingsByDay={new Map()}
        blocksByDay={new Map()}
        clientsById={new Map()}
        mastersById={new Map()}
        servicesById={new Map()}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={noop}
      />,
    )
    expect(document.querySelectorAll('.calendar-grid-cell')).toHaveLength(42)
  })

  it('places a booking into its own day cell, not neighboring ones', () => {
    const days = getWeekGridDays('2026-03-12')
    const booking = makeBooking({ id: 'b-1', startTime: '2026-03-09T10:00:00.000Z', endTime: '2026-03-09T11:00:00.000Z' })
    const bookingsByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [booking] : []]))

    render(
      <CalendarGridView
        days={days}
        layout="week"
        bookingsByDay={bookingsByDay}
        blocksByDay={new Map()}
        clientsById={new Map([[client.id, client]])}
        mastersById={new Map([[master.id, master]])}
        servicesById={new Map([[service.id, service]])}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={noop}
      />,
    )

    // ADMIN card body shows service/master, not the client (see BookingGridCard) — service
    // name is present for both roles, so it's a role-agnostic way to check cell placement.
    expect(within(getCell('2026-03-09')).getByText('Massage')).toBeInTheDocument()
    expect(within(getCell('2026-03-10')).queryByText('Massage')).not.toBeInTheDocument()
  })

  it('marks the today cell and other-period cells with the right classes', () => {
    const days = getMonthGridDays('2026-03-15', '2026-03-20T08:00:00.000Z')

    render(
      <CalendarGridView
        days={days}
        layout="month"
        bookingsByDay={new Map()}
        blocksByDay={new Map()}
        clientsById={new Map()}
        mastersById={new Map()}
        servicesById={new Map()}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={noop}
      />,
    )

    expect(getCell('2026-03-20').className).toContain('calendar-grid-cell--today')
    // Late-February filler day, outside the anchor month
    expect(getCell(days[0].date).className).toContain('calendar-grid-cell--other-period')
    expect(getCell('2026-03-15').className).not.toContain('calendar-grid-cell--other-period')
  })

  it('drops a dragged booking onto a different day cell and calls onDropBooking with that date', () => {
    const days = getWeekGridDays('2026-03-12')
    const booking = makeBooking({ id: 'b-1', startTime: '2026-03-09T10:00:00.000Z', endTime: '2026-03-09T11:00:00.000Z' })
    const bookingsByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [booking] : []]))
    const onDropBooking = vi.fn()

    render(
      <CalendarGridView
        days={days}
        layout="week"
        bookingsByDay={bookingsByDay}
        blocksByDay={new Map()}
        clientsById={new Map([[client.id, client]])}
        mastersById={new Map([[master.id, master]])}
        servicesById={new Map([[service.id, service]])}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={onDropBooking}
      />,
    )

    const card = screen.getByRole('listitem')
    const targetCell = getCell('2026-03-11')
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(targetCell, { dataTransfer })
    fireEvent.drop(targetCell, { dataTransfer })

    expect(onDropBooking).toHaveBeenCalledWith(booking, '2026-03-11')
  })

  it('does not call onDropBooking when dropping onto the booking\'s own day cell', () => {
    const days = getWeekGridDays('2026-03-12')
    const booking = makeBooking({ id: 'b-1', startTime: '2026-03-09T10:00:00.000Z', endTime: '2026-03-09T11:00:00.000Z' })
    const bookingsByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [booking] : []]))
    const onDropBooking = vi.fn()

    render(
      <CalendarGridView
        days={days}
        layout="week"
        bookingsByDay={bookingsByDay}
        blocksByDay={new Map()}
        clientsById={new Map([[client.id, client]])}
        mastersById={new Map([[master.id, master]])}
        servicesById={new Map([[service.id, service]])}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={onDropBooking}
      />,
    )

    const card = screen.getByRole('listitem')
    const ownCell = getCell('2026-03-09')
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(ownCell, { dataTransfer })
    fireEvent.drop(ownCell, { dataTransfer })

    expect(onDropBooking).not.toHaveBeenCalled()
  })

  it('renders no draggable bookings and skips DnD handlers entirely when canDragReschedule is false', () => {
    const days = getWeekGridDays('2026-03-12')
    const booking = makeBooking({ id: 'b-1', startTime: '2026-03-09T10:00:00.000Z', endTime: '2026-03-09T11:00:00.000Z' })
    const bookingsByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [booking] : []]))
    const onDropBooking = vi.fn()

    render(
      <CalendarGridView
        days={days}
        layout="week"
        bookingsByDay={bookingsByDay}
        blocksByDay={new Map()}
        clientsById={new Map([[client.id, client]])}
        mastersById={new Map([[master.id, master]])}
        servicesById={new Map([[service.id, service]])}
        paidBookingIds={new Set()}
        role="MASTER"
        currentMasterId="master-1"
        canDragReschedule={false}
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={onDropBooking}
      />,
    )

    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false')

    const targetCell = getCell('2026-03-11')
    const dataTransfer = makeDataTransfer()
    fireEvent.dragOver(targetCell, { dataTransfer })
    fireEvent.drop(targetCell, { dataTransfer })

    expect(onDropBooking).not.toHaveBeenCalled()
  })
})
