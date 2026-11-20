import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  apiGet,
  apiPost,
  getToken,
  hasRole,
  setToken,
  setUnauthorizedHandler,
  type LoginResult,
  type SessionUser,
} from '../lib/api'
import { AuthContext, type AuthState } from '../lib/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(() => getToken() !== null)
  const [notice, setNotice] = useState<string | null>(null)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // Any 401 from the API ends the session.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
      setNotice('Your session has ended. Please sign in again.')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Restore a stored session.
  useEffect(() => {
    if (!getToken()) return
    apiGet<SessionUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<LoginResult>('/api/auth/login', { email, password })
    setToken(result.token)
    setNotice(null)
    setUser(result.user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, checking, notice, login, logout, can: (role) => hasRole(user?.role, role) }),
    [user, checking, notice, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
