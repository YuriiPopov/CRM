export type Role = 'ADMIN' | 'MASTER'

export interface AuthenticatedUser {
  id: string
  email: string
  role: Role
  salonId: string
  masterId: string | null
}
