import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasterScheduleModal } from './MasterScheduleModal'
import {
  findMasterScheduleConflicts,
  getMasterSchedule,
  upsertMasterSchedule,
} from '../../api/masterSchedules'
import { buildMonthDates, daysInMonth, formatMonthLabel, shiftMonth } from './masterScheduleGrid'
import type { Master } from '../../types/staff'
import type { MasterScheduleRecord } from '../../types/masterSchedule'
import type { Booking } from '../../types/booking'

vi.mock('../../api/masterSchedules', () => ({
  getMasterSchedule: vi.fn(),
  upsertMasterSchedule: vi.fn(),
  findMasterScheduleConflicts: vi.fn(),
}))

const mockedGetMasterSchedule = vi.mocked(getMasterSchedule)
const mockedUpsertMasterSchedule = vi.mocked(upsertMasterSchedule)
const mockedFindConflicts = vi.mocked(findMasterScheduleConflicts)

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specializationCategoryIds: [],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function scheduleRecord(overrides: Partial<MasterScheduleRecord>): MasterScheduleRecord {
  return {
    id: 'schedule-1',
    salonId: 'salon-1',
    masterId: 'master-1',
    date: '2026-03-02T00:00:00.000Z',
    isWorking: true,
    startTime: '09:00',
    endTime: '18:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Модалка по умолчанию открывается на текущем месяце (реальные UTC год/месяц), поэтому тесты
// вычисляют ожидаемые даты/подписи через те же чистые функции, что и компонент, вместо того
// чтобы подделывать системное время (см. отсутствие прецедента fake-timers + userEvent в этом
// наборе тестов).
const now = new Date()
const currentYear = now.getUTCFullYear()
const currentMonth = now.getUTCMonth() + 1
const currentMonthDates = buildMonthDates(currentYear, currentMonth)

afterEach(() => {
  vi.clearAllMocks()
})

describe('MasterScheduleModal', () => {
  it('loads and displays the current month schedule, marking unmarked days as unset', async () => {
    mockedGetMasterSchedule.mockResolvedValue([
      scheduleRecord({
        date: `${currentMonthDates[1]}T00:00:00.000Z`,
        isWorking: true,
        startTime: '10:00',
        endTime: '19:00',
      }),
      scheduleRecord({
        date: `${currentMonthDates[2]}T00:00:00.000Z`,
        isWorking: false,
        startTime: null,
        endTime: null,
      }),
    ])

    render(<MasterScheduleModal master={master} onClose={vi.fn()} />)

    expect(await screen.findByText(formatMonthLabel(currentYear, currentMonth))).toBeInTheDocument()
    expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', currentYear, currentMonth)

    const dayList = screen.getByRole('list')
    const items = within(dayList).getAllByRole('listitem')
    expect(items).toHaveLength(daysInMonth(currentYear, currentMonth))

    const workingDay = items[1]
    expect(within(workingDay).getByRole('button', { name: 'Рабочий' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(workingDay).getByLabelText('С')).toHaveValue('10:00')
    expect(within(workingDay).getByLabelText('До')).toHaveValue('19:00')

    const offDay = items[2]
    expect(within(offDay).getByRole('button', { name: 'Выходной' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const unsetDay = items[3]
    expect(within(unsetDay).getByRole('button', { name: 'Рабочий' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(unsetDay).getByRole('button', { name: 'Выходной' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(unsetDay).queryByLabelText('С')).not.toBeInTheDocument()
  })

  it('marks a day as off when the toggle is clicked, and saves it directly when there are no conflicts', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    mockedFindConflicts.mockResolvedValue([])
    mockedUpsertMasterSchedule.mockResolvedValue([])
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<MasterScheduleModal master={master} onClose={onClose} />)

    const dayList = await screen.findByRole('list')
    const items = within(dayList).getAllByRole('listitem')
    const firstDay = items[0]

    await user.click(within(firstDay).getByRole('button', { name: 'Выходной' }))
    expect(within(firstDay).getByRole('button', { name: 'Выходной' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    const expectedPayload = {
      masterId: 'master-1',
      year: currentYear,
      month: currentMonth,
      days: [{ date: currentMonthDates[0], isWorking: false }],
    }

    await waitFor(() => {
      expect(mockedFindConflicts).toHaveBeenCalledWith(expectedPayload)
    })
    expect(mockedUpsertMasterSchedule).toHaveBeenCalledWith(expectedPayload)
    expect(onClose).toHaveBeenCalled()
  })

  it('enters working hours for a day marked as working', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    const user = userEvent.setup()

    render(<MasterScheduleModal master={master} onClose={vi.fn()} />)

    const dayList = await screen.findByRole('list')
    const items = within(dayList).getAllByRole('listitem')
    const firstDay = items[0]

    await user.click(within(firstDay).getByRole('button', { name: 'Рабочий' }))
    const startInput = within(firstDay).getByLabelText('С')
    await user.clear(startInput)
    await user.type(startInput, '11:00')

    expect(startInput).toHaveValue('11:00')
  })

  it('shows the conflicting bookings and does not save silently when conflicts are found', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    const conflictingBooking: Booking = {
      id: 'booking-1',
      salonId: 'salon-1',
      clientId: 'client-1',
      masterId: 'master-1',
      serviceId: 'service-1',
      startTime: `${currentMonthDates[0]}T10:00:00.000Z`,
      endTime: `${currentMonthDates[0]}T11:00:00.000Z`,
      status: 'CONFIRMED',
      source: 'ADMIN',
      createdAt: '2026-02-01T00:00:00.000Z',
      rescheduledAt: null,
    }
    mockedFindConflicts.mockResolvedValue([conflictingBooking])
    const user = userEvent.setup()

    render(<MasterScheduleModal master={master} onClose={vi.fn()} />)

    const dayList = await screen.findByRole('list')
    const items = within(dayList).getAllByRole('listitem')
    await user.click(within(items[0]).getByRole('button', { name: 'Выходной' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText(/уже есть записи клиентов \(1\)/)).toBeInTheDocument()
    expect(mockedUpsertMasterSchedule).not.toHaveBeenCalled()

    const confirmButton = screen.getByRole('button', { name: 'Сохранить, несмотря на конфликты' })
    mockedUpsertMasterSchedule.mockResolvedValue([])
    await user.click(confirmButton)

    const expectedPayload = {
      masterId: 'master-1',
      year: currentYear,
      month: currentMonth,
      days: [{ date: currentMonthDates[0], isWorking: false }],
    }

    await waitFor(() => {
      expect(mockedUpsertMasterSchedule).toHaveBeenCalledWith(expectedPayload)
    })
    // Второе сохранение больше не должно перепроверять конфликты — они уже подтверждены.
    expect(mockedFindConflicts).toHaveBeenCalledTimes(1)
  })

  it('navigates to the next month and reloads the schedule for it', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    const user = userEvent.setup()

    render(<MasterScheduleModal master={master} onClose={vi.fn()} />)
    await screen.findByText(formatMonthLabel(currentYear, currentMonth))

    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }))

    const next = shiftMonth(currentYear, currentMonth, 1)
    expect(await screen.findByText(formatMonthLabel(next.year, next.month))).toBeInTheDocument()
    expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', next.year, next.month)
  })
})
