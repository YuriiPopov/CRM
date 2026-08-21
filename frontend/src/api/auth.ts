import { apiClient } from './client'
import type { AuthenticatedUser } from '../types/auth'

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
