import type { Role } from './auth'

// GET /users — список пользователей салона (ADMIN), нужен для выбора пользователя в
// настройках видимости дашборда (см. api/dashboardSettings.ts).
export interface UserSummary {
  id: string
  email: string
  role: Role
  masterName: string | null
}
