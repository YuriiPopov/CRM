import { Role } from '@prisma/client';

// Константный список ключей виджетов дашборда (не Prisma enum — см. schema.prisma) — сверен
// с текущим набором секций DashboardPage.tsx на фронте. Добавление нового виджета — правка
// только этого списка (и его зеркала на фронте, см. frontend/src/types/dashboardSettings.ts),
// без миграции БД.
export const DASHBOARD_WIDGET_KEYS = [
  'pending-online-bookings',
  'today-bookings-summary',
  'monthly-revenue',
  'daily-timeline',
  'weekly-timeline',
  'upcoming-bookings',
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

// Виджеты, недоступные роли MASTER ни ролевым дефолтом, ни пользовательским переопределением
// (item61: "Ждут подтверждения" — подтверждать запись может только ADMIN).
export const ADMIN_ONLY_WIDGET_KEYS: readonly string[] = [
  'pending-online-bookings',
];

export function isWidgetAllowedForRole(widgetKey: string, role: Role): boolean {
  return role === Role.ADMIN || !ADMIN_ONLY_WIDGET_KEYS.includes(widgetKey);
}
