import type { Role } from './auth'

// Зеркало backend/src/dashboard-settings/dashboard-widget-keys.ts — держать в синхроне
// с бэкендом вручную, отдельного общего пакета между front/back в проекте нет.
export const DASHBOARD_WIDGET_KEYS = [
  'today-bookings-summary',
  'monthly-revenue',
  'daily-timeline',
  'weekly-timeline',
  'upcoming-bookings',
] as const

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number]

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  'today-bookings-summary': 'Карточка «Записи сегодня»',
  'monthly-revenue': 'Карточка «Выручка за месяц»',
  'daily-timeline': 'Таймлайн на сегодня',
  'weekly-timeline': 'Таймлайн на неделю',
  'upcoming-bookings': 'Ближайшие записи',
}

export interface DashboardWidgetUserOverride {
  userId: string
  widgetKey: string
  visible: boolean
}

export interface DashboardSettingsConfig {
  widgetKeys: readonly string[]
  roleDefaults: Record<Role, Record<string, boolean>>
  userOverrides: DashboardWidgetUserOverride[]
}
