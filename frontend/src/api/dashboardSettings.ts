import { apiClient } from './client'
import type { DashboardSettingsConfig } from '../types/dashboardSettings'
import type { Role } from '../types/auth'

export async function getDashboardSettingsConfig(): Promise<DashboardSettingsConfig> {
  const response = await apiClient.get<DashboardSettingsConfig>('/dashboard-settings/config')
  return response.data
}

export interface SetRoleDefaultInput {
  role: Role
  widgetKey: string
  visible: boolean
}

export async function setRoleDefault(input: SetRoleDefaultInput): Promise<DashboardSettingsConfig> {
  const response = await apiClient.put<DashboardSettingsConfig>('/dashboard-settings/role-defaults', input)
  return response.data
}

export interface SetUserOverrideInput {
  userId: string
  widgetKey: string
  visible: boolean
}

export async function setUserOverride(input: SetUserOverrideInput): Promise<DashboardSettingsConfig> {
  const response = await apiClient.put<DashboardSettingsConfig>('/dashboard-settings/user-overrides', input)
  return response.data
}

export async function removeUserOverride(userId: string, widgetKey: string): Promise<DashboardSettingsConfig> {
  const response = await apiClient.delete<DashboardSettingsConfig>(
    `/dashboard-settings/user-overrides/${userId}/${widgetKey}`,
  )
  return response.data
}

// Эффективный список видимых виджетов для СВОЕГО дашборда (любая роль) — см. DashboardPage.tsx
export async function getEffectiveDashboardWidgets(): Promise<string[]> {
  const response = await apiClient.get<string[]>('/dashboard-settings/effective')
  return response.data
}
