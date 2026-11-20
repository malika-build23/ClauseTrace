import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { apiGet, type Health } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BrandLogo } from './ThemeGraphics'

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
  waking: { text: 'Waking up server…', dot: 'bg-[#D9B08C] animate-pulse' },
  ok: { text: 'Online', dot: 'bg-[#116466]' },
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
  { to: '/profile', label: 'Profile' },
]

const ROLE_BADGE = {
  admin: 'bg-[#2C3531] text-[#D1E8E2] border border-[#2C3531]',
  reviewer: 'bg-[#E6F3F0] text-[#116466] border border-[#D1E8E2]',
  viewer: 'bg-[#F8EFE6] text-[#8C5828] border border-[#D9B08C]',
} as const

export function Layout() {
  const status = STATUS_TEXT[useBackendStatus()]
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-[#D1E8E2] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <BrandLogo className="h-8 w-8" />
              <span className="text-xl font-bold tracking-tight text-[#2C3531] font-display">
                ClauseTrace
              </span>
            </Link>
            <nav className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium" aria-label="Main">
              {NAV.filter((n) => !n.role || can(n.role)).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'rounded-md bg-[#E6F3F0] px-3 py-1 font-semibold text-[#116466] shadow-2xs'
                      : 'rounded-md px-3 py-1 text-[#586b66] hover:bg-[#F5FAF8] hover:text-[#2C3531] transition-colors'
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex items-center gap-2 text-xs font-medium text-muted" aria-live="polite">
              <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
              {status.text}
            </p>
            {user && (
              <div className="flex items-center gap-2 text-sm">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-lg border border-[#D1E8E2] bg-[#F5FAF8] px-2.5 py-1 text-[#2C3531] transition-all hover:border-[#116466] hover:bg-white hover:shadow-sm"
                  title="View Profile & Settings"
                >
                  <span className="max-w-40 truncate font-semibold">
                    {user.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[user.role]}`}>
                    {user.role}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="text-xs font-medium text-muted underline hover:text-[#116466] ml-1 transition-colors"
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
