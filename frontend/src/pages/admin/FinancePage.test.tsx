import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinancePage } from './FinancePage'
import { getRevenueReport } from '../../api/payments'
import type { RevenueReport } from '../../types/payment'

vi.mock('../../api/payments', () => ({ getRevenueReport: vi.fn() }))

const mockedGetRevenueReport = vi.mocked(getRevenueReport)

function mockAxiosError(status: number, message: string) {
  return { isAxiosError: true, response: { status, data: { message } } }
}

const report: RevenueReport = {
  from: '2026-03-01',
  to: '2026-03-11T23:59:59.999Z',
  paymentsCount: 12,
  grossAmount: 5000,
  totalDiscount: 200,
  netRevenue: 4800,
}

describe('FinancePage', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-11T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads the "this month" preset by default and requests an inclusive end-of-day range', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)

    render(<FinancePage />)

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(mockedGetRevenueReport).toHaveBeenCalledWith({
      from: '2026-03-01',
      to: '2026-03-11T23:59:59.999Z',
    })
  })

  it('shows the report as a table with gross/discount/net/count, formatted', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)

    render(<FinancePage />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Валовая выручка')).toBeInTheDocument()
    expect(within(table).getByText('5 000,00')).toBeInTheDocument()
    expect(within(table).getByText('Скидки')).toBeInTheDocument()
    expect(within(table).getByText('200,00')).toBeInTheDocument()
    expect(within(table).getByText('Чистая выручка')).toBeInTheDocument()
    expect(within(table).getByText('4 800,00')).toBeInTheDocument()
    expect(within(table).getByText('Количество платежей')).toBeInTheDocument()
    expect(within(table).getByText('12')).toBeInTheDocument()
  })

  it('also renders the report as a simple bar chart', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)

    render(<FinancePage />)

    await screen.findByRole('table')
    const chart = screen.getByRole('group', { name: /график по выручке/i })
    expect(within(chart).getByRole('img', { name: /валовая выручка: 5\s000,00/i })).toBeInTheDocument()
    expect(within(chart).getByRole('img', { name: /скидки: 200,00/i })).toBeInTheDocument()
    expect(within(chart).getByRole('img', { name: /чистая выручка: 4\s800,00/i })).toBeInTheDocument()
  })

  it('switches presets and refetches with the matching range', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)
    const user = userEvent.setup()

    render(<FinancePage />)
    await screen.findByRole('table')
    mockedGetRevenueReport.mockClear()

    await user.click(screen.getByRole('button', { name: 'Сегодня' }))

    expect(mockedGetRevenueReport).toHaveBeenCalledWith({
      from: '2026-03-11',
      to: '2026-03-11T23:59:59.999Z',
    })
  })

  it('shows a dedicated empty state when the period has no payments, not an empty table', async () => {
    mockedGetRevenueReport.mockResolvedValue({ ...report, paymentsCount: 0, grossAmount: 0, totalDiscount: 0, netRevenue: 0 })

    render(<FinancePage />)

    expect(await screen.findByText(/за выбранный период платежей не было/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a validation error and skips the request when "from" is after "to"', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)
    const user = userEvent.setup()

    render(<FinancePage />)
    await screen.findByRole('table')
    mockedGetRevenueReport.mockClear()

    await user.clear(screen.getByLabelText('С'))
    await user.type(screen.getByLabelText('С'), '2026-03-20')

    expect(await screen.findByRole('alert')).toHaveTextContent(/не может быть позже/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(mockedGetRevenueReport).not.toHaveBeenCalled()
  })

  it('shows a validation error for a range extending into the future', async () => {
    mockedGetRevenueReport.mockResolvedValue(report)
    const user = userEvent.setup()

    render(<FinancePage />)
    await screen.findByRole('table')
    mockedGetRevenueReport.mockClear()

    await user.clear(screen.getByLabelText('По'))
    await user.type(screen.getByLabelText('По'), '2026-03-20')

    expect(await screen.findByRole('alert')).toHaveTextContent(/будущее/i)
    expect(mockedGetRevenueReport).not.toHaveBeenCalled()
  })

  it('shows a friendly error message when the report fails to load', async () => {
    mockedGetRevenueReport.mockRejectedValue(mockAxiosError(500, 'Internal error'))

    render(<FinancePage />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
