import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../lib/api'
import { useAuth } from '../lib/auth'

/** Redirect to /login when signed out; show a notice when the role is too low. */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, checking, can } = useAuth()
  const location = useLocation()

  if (checking) return <p className="p-8 text-center text-sm text-muted">Restoring your session…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (role && !can(role)) {
    return (
      <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-fail">
        This page needs the {role} role. You are signed in as {user.role}.
      </p>
    )
  }
  return <>{children}</>
}
