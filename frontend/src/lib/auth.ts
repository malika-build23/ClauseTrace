import { createContext, useContext } from 'react'
import type { Role, SessionUser } from './api'

export type AuthState = {
  user: SessionUser | null
  /** True while a stored token is being checked on page load. */
  checking: boolean
  /** Set when the session ended on its own (expired, deactivated). */
  notice: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  can: (role: Role) => boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
