// Константный список ключей виджетов дашборда (не Prisma enum — см. schema.prisma) — сверен
// с текущим набором секций DashboardPage.tsx на фронте. Добавление нового виджета — правка
// только этого списка (и его зеркала на фронте, см. frontend/src/types/dashboardSettings.ts),
// без миграции БД.
export const DASHBOARD_WIDGET_KEYS = [
  'today-bookings-summary',
  'monthly-revenue',
  'daily-timeline',
  'weekly-timeline',
  'upcoming-bookings',
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];
