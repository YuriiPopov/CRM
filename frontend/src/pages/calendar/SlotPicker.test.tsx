import { render, screen } from '@testing-library/react'
import { SlotPicker } from './SlotPicker'
import { getAvailableSlots } from '../../api/publicBooking'
import type { AvailableSlotsResponse } from '../../api/publicBooking'

vi.mock('../../api/publicBooking', () => ({ getAvailableSlots: vi.fn() }))

const mockedGetAvailableSlots = vi.mocked(getAvailableSlots)

function response(overrides: Partial<AvailableSlotsResponse>): AvailableSlotsResponse {
  return {
    date: '2026-03-10',
    masterId: 'master-1',
    serviceId: 'service-1',
    isWorkingDay: true,
    slots: [],
    ...overrides,
  }
}

function renderPicker(onSelect = vi.fn()) {
  return render(
    <SlotPicker
      masterId="master-1"
      serviceId="service-1"
      date="2026-03-10"
      selectedStartTime={null}
      onSelect={onSelect}
    />,
  )
}

describe('SlotPicker', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // item51
  it('shows "day off" message instead of the slot list for a full day off by schedule', async () => {
    mockedGetAvailableSlots.mockResolvedValue(response({ isWorkingDay: false, slots: [] }))

    renderPicker()

    expect(await screen.findByText('Мастер в этот день недоступен')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /доступное время/i })).not.toBeInTheDocument()
    expect(screen.queryByText('На эту дату свободных слотов нет')).not.toBeInTheDocument()
  })

  it('shows the "day off" message even if the server unexpectedly still sends slots for that day', async () => {
    mockedGetAvailableSlots.mockResolvedValue(
      response({ isWorkingDay: false, slots: [{ startTime: '2026-03-10T10:00:00.000Z', endTime: '2026-03-10T11:00:00.000Z' }] }),
    )

    renderPicker()

    expect(await screen.findByText('Мастер в этот день недоступен')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /\d{2}:\d{2}/ })).not.toBeInTheDocument()
  })

  it('shows the usual empty-slots message, not the day-off message, when the day is a normal working day with nothing free', async () => {
    mockedGetAvailableSlots.mockResolvedValue(response({ isWorkingDay: true, slots: [] }))

    renderPicker()

    expect(await screen.findByText('На эту дату свободных слотов нет')).toBeInTheDocument()
    expect(screen.queryByText('Мастер в этот день недоступен')).not.toBeInTheDocument()
  })

  it('lists the slots the server returns for a normal (or partially available) working day', async () => {
    mockedGetAvailableSlots.mockResolvedValue(
      response({
        isWorkingDay: true,
        slots: [
          { startTime: '2026-03-10T11:00:00.000Z', endTime: '2026-03-10T12:00:00.000Z' },
          { startTime: '2026-03-10T14:00:00.000Z', endTime: '2026-03-10T15:00:00.000Z' },
        ],
      }),
    )

    renderPicker()

    const list = await screen.findByRole('list', { name: /доступное время/i })
    expect(list.querySelectorAll('button')).toHaveLength(2)
    expect(screen.queryByText('Мастер в этот день недоступен')).not.toBeInTheDocument()
  })
})
