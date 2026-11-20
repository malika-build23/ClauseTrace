import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { apiGet, type Health } from '../lib/api'
import { useAuth } from '../lib/auth'

type Status = 'checking' | 'waking' | 'ok' | 'down'

function useBackendStatus(): Status {
  const [status, setStatus] = useState<Status>('checking')
  useEffect(() => {
    // Free-tier backends sleep when idle; say so instead of looking broken.
    const slow = setTimeout(() => setStatus((s) => (s === 'checking' ? 'waking' : s)), 3000)
    apiGet<Health>('/api/health')
      .then((h) => setStatus(h.db === 'connected' ? 'ok' : 'down'))
      .catch(() => setStatus('down'))
      .finally(() => clearTimeout(slow))
    return () => clearTimeout(slow)
  }, [])
  return status
}

const STATUS_TEXT: Record<Status, { text: string; dot: string }> = {
  checking: { text: 'Connecting…', dot: 'bg-slate-300' },
  waking: { text: 'Waking up server…', dot: 'bg-upcoming animate-pulse' },
  ok: { text: 'Online', dot: 'bg-pass' },
  down: { text: 'Backend unreachable', dot: 'bg-fail' },
}

const NAV: { to: string; label: string; role?: 'admin' | 'reviewer' }[] = [
  { to: '/', label: 'Overview' },
  { to: '/documents', label: 'Documents' },
  { to: '/review', label: 'Review' },
  { to: '/rules', label: 'Rules' },
  { to: '/conflicts', label: 'Conflicts' },
  { to: '/profiles', label: 'Entities' },
  { to: '/audit', label: 'Audit', role: 'reviewer' },
  { to: '/users', label: 'Users', role: 'admin' },
]

const ROLE_BADGE = {
  admin: 'bg-purple-50 text-simulation',
  reviewer: 'bg-blue-50 text-brand',
  viewer: 'bg-slate-100 text-insufficient',
} as const

export function Layout() {
  const status = STATUS_TEXT[useBackendStatus()]
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              ClauseTrace
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Main">
              {NAV.filter((n) => !n.role || can(n.role)).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) => (isActive ? 'font-medium text-brand' : 'text-muted hover:text-ink')}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
              <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
              {status.text}
            </p>
            {user && (
              <div className="flex items-center gap-2 text-sm">
                <span className="max-w-40 truncate" title={user.email}>
                  {user.name}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[user.role]}`}>
                  {user.role}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="text-xs text-muted underline hover:text-ink"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">
        AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable. · Source documents are
        public IFSCA circulars; any entity data is fictional.
      </footer>
    </div>
  )
}
