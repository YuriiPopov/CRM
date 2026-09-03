import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardSettingsPage } from './DashboardSettingsPage'
import { listUsers } from '../../api/users'
import {
  getDashboardSettingsConfig,
  removeUserOverride,
  setRoleDefault,
  setUserOverride,
} from '../../api/dashboardSettings'
import type { DashboardSettingsConfig } from '../../types/dashboardSettings'
import type { UserSummary } from '../../types/user'

vi.mock('../../api/users', () => ({ listUsers: vi.fn() }))
vi.mock('../../api/dashboardSettings', () => ({
  getDashboardSettingsConfig: vi.fn(),
  setRoleDefault: vi.fn(),
  setUserOverride: vi.fn(),
  removeUserOverride: vi.fn(),
}))

const mockedListUsers = vi.mocked(listUsers)
const mockedGetDashboardSettingsConfig = vi.mocked(getDashboardSettingsConfig)
const mockedSetRoleDefault = vi.mocked(setRoleDefault)
const mockedSetUserOverride = vi.mocked(setUserOverride)
const mockedRemoveUserOverride = vi.mocked(removeUserOverride)

const adminUser: UserSummary = { id: 'admin-1', email: 'admin@b4u.local', role: 'ADMIN', masterName: null }
const masterUser: UserSummary = { id: 'master-user-1', email: 'master@b4u.local', role: 'MASTER', masterName: 'Master One' }

function baseConfig(): DashboardSettingsConfig {
  return {
    widgetKeys: ['today-bookings-summary', 'monthly-revenue', 'daily-timeline', 'weekly-timeline', 'upcoming-bookings'],
    roleDefaults: {
      ADMIN: {
        'today-bookings-summary': true,
        'monthly-revenue': true,
        'daily-timeline': true,
        'weekly-timeline': true,
        'upcoming-bookings': true,
      },
      MASTER: {
        'today-bookings-summary': true,
        'monthly-revenue': false,
        'daily-timeline': true,
        'weekly-timeline': true,
        'upcoming-bookings': true,
      },
    },
    userOverrides: [{ userId: 'master-user-1', widgetKey: 'daily-timeline', visible: false }],
  }
}

function renderPage() {
  return render(<DashboardSettingsPage />)
}

// Некоторые подписи (имя пользователя, название виджета) встречаются и в <option> формы
// переопределения, и в таблице — берём именно табличную строку (th/td), а не option.
async function findTableRow(text: string): Promise<HTMLElement> {
  const matches = await screen.findAllByText(text)
  const match = matches.find((el) => el.closest('option') === null)
  if (!match) throw new Error(`"${text}" not found outside of an <option>`)
  return match.closest('tr')!
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('DashboardSettingsPage', () => {
  it('renders the role-default matrix reflecting the loaded config', async () => {
    mockedGetDashboardSettingsConfig.mockResolvedValue(baseConfig())
    mockedListUsers.mockResolvedValue([adminUser, masterUser])

    renderPage()

    const row = await findTableRow('Таймлайн на неделю')
    const checkboxes = within(row).getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeChecked()

    const revenueRow = await findTableRow('Карточка «Выручка за месяц»')
    const revenueCheckboxes = within(revenueRow).getAllByRole('checkbox')
    expect(revenueCheckboxes[0]).toBeChecked()
    expect(revenueCheckboxes[1]).not.toBeChecked()
  })

  it('lists existing user overrides with the resolved user label', async () => {
    mockedGetDashboardSettingsConfig.mockResolvedValue(baseConfig())
    mockedListUsers.mockResolvedValue([adminUser, masterUser])

    renderPage()

    const overrideRow = await findTableRow('Master One (master@b4u.local)')
    expect(within(overrideRow).getByText('Таймлайн на сегодня')).toBeInTheDocument()
    expect(within(overrideRow).getByText('Скрыт')).toBeInTheDocument()
  })

  it('toggling a role-default checkbox calls setRoleDefault and re-renders from the response', async () => {
    const user = userEvent.setup()
    mockedGetDashboardSettingsConfig.mockResolvedValue(baseConfig())
    mockedListUsers.mockResolvedValue([adminUser, masterUser])
    mockedSetRoleDefault.mockResolvedValue({
      ...baseConfig(),
      roleDefaults: {
        ...baseConfig().roleDefaults,
        MASTER: { ...baseConfig().roleDefaults.MASTER, 'monthly-revenue': true },
      },
    })

    renderPage()

    const revenueRow = await findTableRow('Карточка «Выручка за месяц»')
    const masterCheckbox = within(revenueRow).getAllByRole('checkbox')[1]
    await user.click(masterCheckbox)

    expect(mockedSetRoleDefault).toHaveBeenCalledWith({
      role: 'MASTER',
      widgetKey: 'monthly-revenue',
      visible: true,
    })
    expect(await within(revenueRow).findAllByRole('checkbox')).toSatisfy((els: HTMLInputElement[]) =>
      els[1].checked,
    )
  })

  it('removing an override calls removeUserOverride with the row keys', async () => {
    const user = userEvent.setup()
    mockedGetDashboardSettingsConfig.mockResolvedValue(baseConfig())
    mockedListUsers.mockResolvedValue([adminUser, masterUser])
    mockedRemoveUserOverride.mockResolvedValue({ ...baseConfig(), userOverrides: [] })

    renderPage()

    const resetButton = await screen.findByRole('button', { name: 'Сбросить' })
    await user.click(resetButton)

    expect(mockedRemoveUserOverride).toHaveBeenCalledWith('master-user-1', 'daily-timeline')
    expect(screen.getByText('Переопределений пока нет')).toBeInTheDocument()
  })

  it('submitting the override form calls setUserOverride with the selected values', async () => {
    const user = userEvent.setup()
    mockedGetDashboardSettingsConfig.mockResolvedValue(baseConfig())
    mockedListUsers.mockResolvedValue([adminUser, masterUser])
    mockedSetUserOverride.mockResolvedValue(baseConfig())

    renderPage()

    await screen.findByText('Пользовательские переопределения')
    await user.selectOptions(screen.getByLabelText('Пользователь'), 'admin-1')
    await user.selectOptions(screen.getByLabelText('Виджет'), 'monthly-revenue')
    await user.click(screen.getByRole('button', { name: 'Добавить переопределение' }))

    expect(mockedSetUserOverride).toHaveBeenCalledWith({
      userId: 'admin-1',
      widgetKey: 'monthly-revenue',
      visible: true,
    })
  })

  it('shows an error message when loading fails', async () => {
    mockedGetDashboardSettingsConfig.mockRejectedValue(new Error('network error'))
    mockedListUsers.mockResolvedValue([])

    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
