import type { Role } from './auth'

// Зеркало backend/src/dashboard-settings/dashboard-widget-keys.ts — держать в синхроне
// с бэкендом вручную, отдельного общего пакета между front/back в проекте нет.
export const DASHBOARD_WIDGET_KEYS = [
  'pending-online-bookings',
  'today-bookings-summary',
  'monthly-revenue',
  'daily-timeline',
  'weekly-timeline',
  'upcoming-bookings',
] as const

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number]

// Зеркало ADMIN_ONLY_WIDGET_KEYS на бэкенде — для MASTER такой виджет недоступен вовсе
// (ни ролевым дефолтом, ни переопределением), бэкенд отклоняет такую настройку с 400.
export const ADMIN_ONLY_WIDGET_KEYS: readonly string[] = ['pending-online-bookings']

export function isWidgetAllowedForRole(widgetKey: string, role: Role): boolean {
  return role === 'ADMIN' || !ADMIN_ONLY_WIDGET_KEYS.includes(widgetKey)
}

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  'pending-online-bookings': 'Ждут подтверждения (онлайн-записи)',
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
