import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasterScheduleModal } from './MasterScheduleModal'
import {
  findMasterScheduleConflicts,
  getMasterSchedule,
  upsertMasterSchedule,
} from '../../api/masterSchedules'
import { rescheduleBooking } from '../../api/bookings'
import { buildMonthDates, daysInMonth, formatMonthLabel, shiftMonth } from './masterScheduleGrid'
import type { Master } from '../../types/staff'
import type { Service } from '../../types/service'
import type { MasterScheduleRecord } from '../../types/masterSchedule'
import type { Booking } from '../../types/booking'

vi.mock('../../api/masterSchedules', () => ({
  getMasterSchedule: vi.fn(),
  upsertMasterSchedule: vi.fn(),
  findMasterScheduleConflicts: vi.fn(),
}))
vi.mock('../../api/bookings', () => ({
  rescheduleBooking: vi.fn(),
}))
// RescheduleModal переиспользуется как есть (item28, подзадача №36), но его собственная логика
// (SlotPicker → публичный GET /public/booking/slots) уже вне зоны ответственности этого файла —
// здесь важно только, что MasterScheduleModal его правильно открывает/закрывает и реагирует на
// onRescheduled, поэтому подменяем его лёгким стабом без реального выбора времени.
vi.mock('../calendar/RescheduleModal', () => ({
  RescheduleModal: ({ onRescheduled, onClose }: { onRescheduled: () => void; onClose: () => void }) => (
    <div>
      <p>Перенос записи (стаб)</p>
      <button
        type="button"
        onClick={() => {
          onRescheduled()
          onClose()
        }}
      >
        Подтвердить перенос (стаб)
      </button>
    </div>
  ),
}))

const mockedGetMasterSchedule = vi.mocked(getMasterSchedule)
const mockedUpsertMasterSchedule = vi.mocked(upsertMasterSchedule)
const mockedFindConflicts = vi.mocked(findMasterScheduleConflicts)
const mockedRescheduleBooking = vi.mocked(rescheduleBooking)

const master: Master = {
  id: 'master-1',
  salonId: 'salon-1',
  name: 'Anna',
  specializationCategoryIds: [],
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const masterTwo: Master = {
  id: 'master-2',
  salonId: 'salon-1',
  name: 'Boris',
  specializationCategoryIds: [],
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

function renderModal(overrides: { masters?: Master[]; services?: Service[]; onClose?: () => void } = {}) {
  return render(
    <MasterScheduleModal
      master={master}
      masters={overrides.masters ?? [master, masterTwo]}
      services={overrides.services ?? [service]}
      onClose={overrides.onClose ?? vi.fn()}
    />,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

// Ячейки сетки — кнопки с доступным именем "День N" (см. MasterScheduleModal); попап с
// переключателями открывается по клику и живёт вне ячейки, поэтому в тестах ниже сначала
// находится нужная ячейка по номеру дня, а затем контролы ищутся в открывшемся попапе.
function getDayCell(dayNumber: number) {
  return screen.getByRole('button', { name: `День ${dayNumber}` })
}

function getDayPopover() {
  return screen.getByRole('dialog', { name: /настройки дня/i })
}

describe('MasterScheduleModal', () => {
  it('renders one grid cell per day of the month, with a leading/trailing empty run to fill the 6x7 grid', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    renderModal()

    await screen.findByText(formatMonthLabel(currentYear, currentMonth))

    expect(document.querySelectorAll('.master-schedule-grid-cell')).toHaveLength(42)
    expect(document.querySelectorAll('.master-schedule-grid-cell--empty')).toHaveLength(
      42 - daysInMonth(currentYear, currentMonth),
    )
    // Ячейки соседних месяцев не кликабельны — это <div>, а не <button>.
    for (const emptyCell of document.querySelectorAll('.master-schedule-grid-cell--empty')) {
      expect(emptyCell.tagName).toBe('DIV')
    }
    expect(screen.getAllByRole('button', { name: /^День \d+$/ })).toHaveLength(
      daysInMonth(currentYear, currentMonth),
    )
  })

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

    renderModal()

    expect(await screen.findByText(formatMonthLabel(currentYear, currentMonth))).toBeInTheDocument()
    expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', currentYear, currentMonth)

    const workingDayCell = getDayCell(2)
    expect(workingDayCell).toHaveClass('master-schedule-grid-cell--working')
    expect(within(workingDayCell).getByText('10:00–19:00')).toBeInTheDocument()

    const offDayCell = getDayCell(3)
    expect(offDayCell).toHaveClass('master-schedule-grid-cell--off')

    const unsetDayCell = getDayCell(4)
    expect(unsetDayCell).toHaveClass('master-schedule-grid-cell--unset')

    expect(screen.queryByRole('dialog', { name: /настройки дня/i })).not.toBeInTheDocument()
  })

  it('opens a popover with controls on cell click, and the toggles/hours in it reflect that day', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    const user = userEvent.setup()

    renderModal()
    await screen.findByText(formatMonthLabel(currentYear, currentMonth))

    await user.click(getDayCell(1))
    const popover = getDayPopover()
    expect(within(popover).getByRole('button', { name: 'Рабочий' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(popover).getByRole('button', { name: 'Выходной' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(popover).queryByLabelText('С')).not.toBeInTheDocument()

    // Клик по той же ячейке снова закрывает попап.
    await user.click(getDayCell(1))
    expect(screen.queryByRole('dialog', { name: /настройки дня/i })).not.toBeInTheDocument()
  })

  it('marks a day as off when the toggle is clicked, and saves it directly when there are no conflicts', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    mockedFindConflicts.mockResolvedValue([])
    mockedUpsertMasterSchedule.mockResolvedValue([])
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderModal({ onClose })

    await screen.findByText(formatMonthLabel(currentYear, currentMonth))
    await user.click(getDayCell(1))
    await user.click(within(getDayPopover()).getByRole('button', { name: 'Выходной' }))
    expect(within(getDayPopover()).getByRole('button', { name: 'Выходной' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(getDayCell(1)).toHaveClass('master-schedule-grid-cell--off')

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

    renderModal()
    await screen.findByText(formatMonthLabel(currentYear, currentMonth))

    await user.click(getDayCell(1))
    await user.click(within(getDayPopover()).getByRole('button', { name: 'Рабочий' }))
    const startInput = within(getDayPopover()).getByLabelText('С')
    await user.clear(startInput)
    await user.type(startInput, '11:00')

    expect(startInput).toHaveValue('11:00')
    expect(getDayCell(1)).toHaveClass('master-schedule-grid-cell--working')
    expect(within(getDayCell(1)).getByText('11:00–18:00')).toBeInTheDocument()
  })

  it('navigates to the next month and reloads the schedule for it', async () => {
    mockedGetMasterSchedule.mockResolvedValue([])
    const user = userEvent.setup()

    renderModal()
    await screen.findByText(formatMonthLabel(currentYear, currentMonth))

    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }))

    const next = shiftMonth(currentYear, currentMonth, 1)
    expect(await screen.findByText(formatMonthLabel(next.year, next.month))).toBeInTheDocument()
    expect(mockedGetMasterSchedule).toHaveBeenCalledWith('master-1', next.year, next.month)
  })

  // Разрешение конфликтов существующих записей (Backlog item28, подзадача №36).
  describe('conflict resolution', () => {
    function conflictBooking(overrides: Partial<Booking> = {}): Booking {
      return {
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
        ...overrides,
      }
    }

    async function markFirstDayOffAndSave(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByRole('button', { name: 'День 1' })
      await user.click(getDayCell(1))
      await user.click(within(getDayPopover()).getByRole('button', { name: 'Выходной' }))
      await user.click(screen.getByRole('button', { name: 'Сохранить' }))
    }

    it('shows each conflicting booking with resolution actions and blocks saving until all are resolved', async () => {
      mockedGetMasterSchedule.mockResolvedValue([])
      mockedFindConflicts.mockResolvedValue([conflictBooking()])
      const user = userEvent.setup()

      renderModal()
      await markFirstDayOffAndSave(user)

      expect(await screen.findByText(/уже есть записи клиентов \(1\)/)).toBeInTheDocument()
      expect(screen.getByText('Massage')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Перенести' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Переназначить другому мастеру' })).toBeInTheDocument()

      const saveButton = screen.getByRole('button', { name: 'Сохранить' })
      expect(saveButton).toBeDisabled()
      expect(screen.getByText('Сначала решите конфликты')).toBeInTheDocument()
      expect(mockedUpsertMasterSchedule).not.toHaveBeenCalled()
    })

    it('resolves a conflict via "Перенести" (RescheduleModal) and unblocks saving', async () => {
      mockedGetMasterSchedule.mockResolvedValue([])
      mockedFindConflicts.mockResolvedValue([conflictBooking()])
      mockedUpsertMasterSchedule.mockResolvedValue([])
      const user = userEvent.setup()

      renderModal()
      await markFirstDayOffAndSave(user)
      await screen.findByText(/уже есть записи клиентов/)

      await user.click(screen.getByRole('button', { name: 'Перенести' }))
      expect(screen.getByText('Перенос записи (стаб)')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Подтвердить перенос (стаб)' }))

      expect(screen.queryByText(/уже есть записи клиентов/)).not.toBeInTheDocument()
      expect(screen.queryByText('Перенос записи (стаб)')).not.toBeInTheDocument()

      const saveButton = screen.getByRole('button', { name: 'Сохранить' })
      expect(saveButton).toBeEnabled()

      await user.click(saveButton)
      await waitFor(() => expect(mockedUpsertMasterSchedule).toHaveBeenCalled())
      // Конфликты уже разрешены локально — второй раз /conflicts не перезапрашивается.
      expect(mockedFindConflicts).toHaveBeenCalledTimes(1)
    })

    it('resolves a conflict via "Переназначить другому мастеру" and unblocks saving', async () => {
      mockedGetMasterSchedule.mockResolvedValue([])
      mockedFindConflicts.mockResolvedValue([conflictBooking()])
      mockedRescheduleBooking.mockResolvedValue(conflictBooking({ masterId: 'master-2' }))
      mockedUpsertMasterSchedule.mockResolvedValue([])
      const user = userEvent.setup()

      renderModal()
      await markFirstDayOffAndSave(user)
      await screen.findByText(/уже есть записи клиентов/)

      await user.click(screen.getByRole('button', { name: 'Переназначить другому мастеру' }))
      const masterSelect = screen.getByLabelText('Новый мастер')
      // Сам мастер, чей график меняется, не предлагается в качестве нового — переназначение
      // ему самому не имеет смысла.
      expect(within(masterSelect).queryByText('Anna')).not.toBeInTheDocument()
      await user.selectOptions(masterSelect, 'master-2')
      await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

      await waitFor(() => {
        expect(mockedRescheduleBooking).toHaveBeenCalledWith('booking-1', {
          startTime: conflictBooking().startTime,
          masterId: 'master-2',
        })
      })
      expect(screen.queryByText(/уже есть записи клиентов/)).not.toBeInTheDocument()

      const saveButton = screen.getByRole('button', { name: 'Сохранить' })
      expect(saveButton).toBeEnabled()
      await user.click(saveButton)
      await waitFor(() => expect(mockedUpsertMasterSchedule).toHaveBeenCalled())
    })

    it('shows a friendly error and keeps the conflict listed when reassignment fails', async () => {
      mockedGetMasterSchedule.mockResolvedValue([])
      mockedFindConflicts.mockResolvedValue([conflictBooking()])
      mockedRescheduleBooking.mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { message: 'Master does not work on this day' } },
      })
      const user = userEvent.setup()

      renderModal()
      await markFirstDayOffAndSave(user)
      await screen.findByText(/уже есть записи клиентов/)

      await user.click(screen.getByRole('button', { name: 'Переназначить другому мастеру' }))
      await user.selectOptions(screen.getByLabelText('Новый мастер'), 'master-2')
      await user.click(screen.getByRole('button', { name: 'Подтвердить' }))

      expect(await screen.findByText(/master does not work on this day/i)).toBeInTheDocument()
      expect(screen.getByText(/уже есть записи клиентов \(1\)/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    })
  })
})
