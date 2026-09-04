import { fireEvent, render, screen, within } from '@testing-library/react'
import { CalendarGridView } from './CalendarGridView'
import { getMonthGridDays, getWeekGridDays } from './calendarGrid'
import type { Booking } from '../../types/booking'
import type { Client } from '../../types/client'
import type { Master } from '../../types/staff'
import type { MasterBlock } from '../../types/masterBlock'
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
    originalStartTime: null,
    originalEndTime: null,
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
  photo: null,
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

function makeBlock(overrides: Partial<MasterBlock>): MasterBlock {
  return {
    id: 'block-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    startTime: '2026-03-09T09:00:00.000Z',
    endTime: '2026-03-09T10:00:00.000Z',
    reason: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    createdById: null,
    ...overrides,
  }
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
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

  // Регулярный график работы мастера (item28, подзадача №35) — дни, нерабочие для мастера,
  // на которого скоуплена сетка (см. CalendarPage.scheduleMasterId).
  describe('schedule-blocked days', () => {
    it('darkens a cell whose date is in blockedDates', () => {
      const days = getWeekGridDays('2026-03-12')

      render(
        <CalendarGridView
          days={days}
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
          blockedDates={new Set(['2026-03-11'])}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      expect(getCell('2026-03-11').className).toContain('calendar-grid-cell--schedule-blocked')
      expect(getCell('2026-03-12').className).not.toContain('calendar-grid-cell--schedule-blocked')
    })

    it('does not darken any cell when blockedDates is empty ("not yet configured" or "Все мастера")', () => {
      const days = getWeekGridDays('2026-03-12')

      render(
        <CalendarGridView
          days={days}
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
          blockedDates={new Set()}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      for (const day of days) {
        expect(getCell(day.date).className).not.toContain('calendar-grid-cell--schedule-blocked')
      }
    })

    it('does not call onDropBooking when dropping onto a schedule-blocked cell', () => {
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
          blockedDates={new Set(['2026-03-11'])}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={onDropBooking}
        />,
      )

      const card = screen.getByRole('listitem')
      const blockedCell = getCell('2026-03-11')
      const dataTransfer = makeDataTransfer()

      fireEvent.dragStart(card, { dataTransfer })
      fireEvent.dragOver(blockedCell, { dataTransfer })
      fireEvent.drop(blockedCell, { dataTransfer })

      expect(onDropBooking).not.toHaveBeenCalled()
    })
  })

  // item49 — часы дня вне startTime–endTime графика мастера, для дней isWorking: true.
  describe('partial availability overlay', () => {
    it('renders top and bottom unavailable overlays sized to the hours outside startTime–endTime', () => {
      const days = getWeekGridDays('2026-03-12')

      render(
        <CalendarGridView
          days={days}
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
          blockedDates={new Set()}
          partialAvailabilityByDate={new Map([['2026-03-11', { startTime: '14:00', endTime: '20:00' }]])}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      const cell = getCell('2026-03-11')
      const top = cell.querySelector('.calendar-grid-cell-unavailable--top') as HTMLElement
      const bottom = cell.querySelector('.calendar-grid-cell-unavailable--bottom') as HTMLElement

      expect(top).toBeInTheDocument()
      expect(top.style.height).toBe(`${(14 / 24) * 100}%`)
      expect(bottom).toBeInTheDocument()
      expect(bottom.style.height).toBe(`${(4 / 24) * 100}%`)

      expect(getCell('2026-03-12').querySelector('.calendar-grid-cell-unavailable--top')).not.toBeInTheDocument()
    })

    it('renders no overlay for a fully working day with no schedule restriction', () => {
      const days = getWeekGridDays('2026-03-12')

      render(
        <CalendarGridView
          days={days}
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
          blockedDates={new Set()}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      for (const day of days) {
        expect(getCell(day.date).querySelector('.calendar-grid-cell-unavailable')).not.toBeInTheDocument()
      }
    })

    it('does not render a partial overlay for a fully schedule-blocked day, even if both maps carry the date', () => {
      const days = getWeekGridDays('2026-03-12')

      render(
        <CalendarGridView
          days={days}
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
          blockedDates={new Set(['2026-03-11'])}
          partialAvailabilityByDate={new Map([['2026-03-11', { startTime: '14:00', endTime: '20:00' }]])}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      const cell = getCell('2026-03-11')
      expect(cell.className).toContain('calendar-grid-cell--schedule-blocked')
      expect(cell.querySelector('.calendar-grid-cell-unavailable')).not.toBeInTheDocument()
    })
  })

  // item47: раньше .calendar-grid-block-chip показывал только время, без указания мастера —
  // выбор конкретного мастера в фильтре выглядел так, будто чужие блокировки всё ещё видны.
  describe('block chip avatar', () => {
    it('renders a MasterAvatar on the block chip when the master resolves', () => {
      const days = getWeekGridDays('2026-03-12')
      const block = makeBlock({})
      const blocksByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [block] : []]))

      render(
        <CalendarGridView
          days={days}
          layout="week"
          bookingsByDay={new Map()}
          blocksByDay={blocksByDay}
          clientsById={new Map()}
          mastersById={new Map([[master.id, master]])}
          servicesById={new Map()}
          paidBookingIds={new Set()}
          role="ADMIN"
          currentMasterId={null}
          canDragReschedule
          blockedDates={new Set()}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      expect(getCell('2026-03-09').querySelector('.calendar-grid-block-chip-avatar')).toBeInTheDocument()
    })

    it('renders no avatar on the block chip when the master is not resolved (e.g. "Моё расписание")', () => {
      const days = getWeekGridDays('2026-03-12')
      const block = makeBlock({})
      const blocksByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [block] : []]))

      render(
        <CalendarGridView
          days={days}
          layout="week"
          bookingsByDay={new Map()}
          blocksByDay={blocksByDay}
          clientsById={new Map()}
          mastersById={new Map()}
          servicesById={new Map()}
          paidBookingIds={new Set()}
          role="MASTER"
          currentMasterId="master-1"
          canDragReschedule={false}
          blockedDates={new Set()}
          partialAvailabilityByDate={new Map()}
          busyBookingId={null}
          onReschedule={noop}
          onDropBooking={noop}
        />,
      )

      expect(getCell('2026-03-09').querySelector('.calendar-grid-block-chip-avatar')).not.toBeInTheDocument()
    })
  })

  // item48: раньше все блоки одного дня рендерились перед всеми записями (два отдельных
  // списка), независимо от времени — блокировка на 15:00 оказывалась выше записи на 10:00.
  it('interleaves a later block with an earlier booking in the cell in chronological order', () => {
    const days = getWeekGridDays('2026-03-12')
    const earlyBooking = makeBooking({
      id: 'b-early',
      startTime: '2026-03-09T10:00:00.000Z',
      endTime: '2026-03-09T11:00:00.000Z',
    })
    const lateBlock = makeBlock({ id: 'block-late', startTime: '2026-03-09T15:00:00.000Z', endTime: '2026-03-09T16:00:00.000Z' })
    const bookingsByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [earlyBooking] : []]))
    const blocksByDay = new Map(days.map((d) => [d.date, d.date === '2026-03-09' ? [lateBlock] : []]))

    render(
      <CalendarGridView
        days={days}
        layout="week"
        bookingsByDay={bookingsByDay}
        blocksByDay={blocksByDay}
        clientsById={new Map([[client.id, client]])}
        mastersById={new Map([[master.id, master]])}
        servicesById={new Map([[service.id, service]])}
        paidBookingIds={new Set()}
        role="ADMIN"
        currentMasterId={null}
        canDragReschedule
        blockedDates={new Set()}
        partialAvailabilityByDate={new Map()}
        busyBookingId={null}
        onReschedule={noop}
        onDropBooking={noop}
      />,
    )

    const items = getCell('2026-03-09').querySelectorAll('.calendar-grid-cell-bookings > li')
    expect(items).toHaveLength(2)
    expect(items[0]!.className).toContain('booking-grid-card')
    expect(items[1]!.className).toContain('calendar-grid-block-chip')
  })
})
