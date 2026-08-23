import { apiClient } from './client'
import type { AuthenticatedUser, Role } from '../types/auth'

interface LoginResponse {
  accessToken: string
}

export async function login(email: string, password: string): Promise<string> {
  const response = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return response.data.accessToken
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  const response = await apiClient.get<AuthenticatedUser>('/auth/me')
  return response.data
}

export interface RegisterUserInput {
  email: string
  password: string
  role: Role
  // Логин мастера — привязывается к уже существующей записи Master (см. CreateMasterModal:
  // сначала POST /staff, потом этот эндпоинт с её id).
  masterId?: string
}

interface RegisteredUser {
  id: string
  email: string
  role: Role
  salonId: string
  masterId: string | null
}

// ADMIN-only на бэкенде (см. RolesGuard) — создаёт логин для сотрудника (admin/master).
export async function registerUser(input: RegisterUserInput): Promise<RegisteredUser> {
  const response = await apiClient.post<RegisteredUser>('/auth/register', input)
  return response.data
}
