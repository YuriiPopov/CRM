import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { listUsers } from '../../api/users'
import {
  getDashboardSettingsConfig,
  removeUserOverride,
  setRoleDefault,
  setUserOverride,
} from '../../api/dashboardSettings'
import { getApiErrorMessage } from '../../api/errors'
import { DASHBOARD_WIDGET_LABELS } from '../../types/dashboardSettings'
import type { DashboardSettingsConfig } from '../../types/dashboardSettings'
import type { UserSummary } from '../../types/user'
import type { Role } from '../../types/auth'

const ROLES: Role[] = ['ADMIN', 'MASTER']
const ROLE_LABELS: Record<Role, string> = { ADMIN: 'Администратор', MASTER: 'Мастер' }

function userLabel(user: UserSummary): string {
  return user.masterName ? `${user.masterName} (${user.email})` : user.email
}

// Экран настроек видимости виджетов дашборда (ADMIN) — два уровня, как описано в
// DashboardSettingsService: ролевой дефолт (таблица ниже) и пользовательское
// переопределение (форма + таблица ниже), которое всегда приоритетнее дефолта.
export function DashboardSettingsPage() {
  const [config, setConfig] = useState<DashboardSettingsConfig | null>(null)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [overrideUserId, setOverrideUserId] = useState('')
  const [overrideWidgetKey, setOverrideWidgetKey] = useState('')
  const [overrideVisible, setOverrideVisible] = useState(true)
  const [savingOverride, setSavingOverride] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([getDashboardSettingsConfig(), listUsers()])
      .then(([loadedConfig, loadedUsers]) => {
        if (cancelled) return
        setConfig(loadedConfig)
        setUsers(loadedUsers)
        setOverrideUserId((prev) => prev || loadedUsers[0]?.id || '')
        setOverrideWidgetKey((prev) => prev || loadedConfig.widgetKeys[0] || '')
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить настройки дашборда'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  const handleRoleDefaultChange = (role: Role, widgetKey: string, visible: boolean) => {
    setActionError(null)
    setRoleDefault({ role, widgetKey, visible })
      .then(setConfig)
      .catch((error: unknown) => setActionError(getApiErrorMessage(error, 'Не удалось сохранить настройку')))
  }

  const handleAddOverride = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!overrideUserId || !overrideWidgetKey) return

    setActionError(null)
    setSavingOverride(true)
    setUserOverride({ userId: overrideUserId, widgetKey: overrideWidgetKey, visible: overrideVisible })
      .then(setConfig)
      .catch((error: unknown) => setActionError(getApiErrorMessage(error, 'Не удалось сохранить переопределение')))
      .finally(() => setSavingOverride(false))
  }

  const handleRemoveOverride = (userId: string, widgetKey: string) => {
    setActionError(null)
    removeUserOverride(userId, widgetKey)
      .then(setConfig)
      .catch((error: unknown) => setActionError(getApiErrorMessage(error, 'Не удалось сбросить переопределение')))
  }

  if (loading) {
    return <p>Загрузка…</p>
  }

  return (
    <section>
      <h1>Видимость дашборда</h1>

      {loadError && <p role="alert">{loadError}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      {config && (
        <>
          <h2>Ролевые дефолты</h2>
          <table className="finance-table">
            <thead>
              <tr>
                <th scope="col">Виджет</th>
                {ROLES.map((role) => (
                  <th key={role} scope="col">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.widgetKeys.map((widgetKey) => (
                <tr key={widgetKey}>
                  <th scope="row">{DASHBOARD_WIDGET_LABELS[widgetKey as keyof typeof DASHBOARD_WIDGET_LABELS] ?? widgetKey}</th>
                  {ROLES.map((role) => (
                    <td key={role}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={config.roleDefaults[role]?.[widgetKey] ?? true}
                          onChange={(event) => handleRoleDefaultChange(role, widgetKey, event.target.checked)}
                        />
                        Видим
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Пользовательские переопределения</h2>

          <form className="calendar-toolbar" onSubmit={handleAddOverride}>
            <label htmlFor="override-user">
              Пользователь
              <select
                id="override-user"
                value={overrideUserId}
                onChange={(event) => setOverrideUserId(event.target.value)}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userLabel(user)}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="override-widget">
              Виджет
              <select
                id="override-widget"
                value={overrideWidgetKey}
                onChange={(event) => setOverrideWidgetKey(event.target.value)}
              >
                {config.widgetKeys.map((widgetKey) => (
                  <option key={widgetKey} value={widgetKey}>
                    {DASHBOARD_WIDGET_LABELS[widgetKey as keyof typeof DASHBOARD_WIDGET_LABELS] ?? widgetKey}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={overrideVisible}
                onChange={(event) => setOverrideVisible(event.target.checked)}
              />
              Видим
            </label>

            <button type="submit" disabled={savingOverride || !overrideUserId || !overrideWidgetKey}>
              Добавить переопределение
            </button>
          </form>

          {config.userOverrides.length === 0 ? (
            <p>Переопределений пока нет</p>
          ) : (
            <table className="finance-table">
              <thead>
                <tr>
                  <th scope="col">Пользователь</th>
                  <th scope="col">Виджет</th>
                  <th scope="col">Видимость</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {config.userOverrides.map((override) => {
                  const user = usersById.get(override.userId)
                  return (
                    <tr key={`${override.userId}-${override.widgetKey}`}>
                      <td>{user ? userLabel(user) : override.userId}</td>
                      <td>
                        {DASHBOARD_WIDGET_LABELS[override.widgetKey as keyof typeof DASHBOARD_WIDGET_LABELS] ??
                          override.widgetKey}
                      </td>
                      <td>{override.visible ? 'Виден' : 'Скрыт'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveOverride(override.userId, override.widgetKey)}
                        >
                          Сбросить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
