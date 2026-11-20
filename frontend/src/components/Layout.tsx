import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { HelpCircle, LogOut, Search } from 'lucide-react'
import { apiGet, type Health } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BrandLogo } from './ThemeGraphics'
import { ThemeToggle } from './ui/ThemeToggle'
import { WakeUpIndicator } from './ui/WakeUpIndicator'
import { GuidedTour } from './tour/GuidedTour'
import { openTour } from '../lib/tour'
import { CommandPalette } from './command/CommandPalette'

type Status = 'checking' | 'waking' | 'ok' | 'down'

function useBackendStatus(): Status {
  const [status, setStatus] = useState<Status>('checking')
  useEffect(() => {
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
  checking: { text: 'Connecting…', dot: 'bg-muted' },
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
  { to: '/profile', label: 'Profile' },
]

const ROLE_BADGE = {
  admin: 'bg-navy text-mist border border-navy dark:bg-mist dark:text-navy',
  reviewer: 'bg-brand-light text-brand border border-line',
  viewer: 'bg-rose/20 text-[#6B3254] dark:text-rose border border-rose/40',
} as const

export function Layout() {
  const status = STATUS_TEXT[useBackendStatus()]
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-surface flex flex-col transition-colors duration-200">
      <WakeUpIndicator />
      <GuidedTour />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <BrandLogo className="h-8 w-8 shrink-0" />
              <span className="text-xl font-bold tracking-tight text-ink font-display">
                ClauseTrace
              </span>
            </Link>
            <nav className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm font-medium" aria-label="Main">
              {NAV.filter((n) => !n.role || can(n.role)).map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'rounded-md bg-brand-light px-3 py-1 font-semibold text-brand shadow-2xs'
                      : 'rounded-md px-3 py-1 text-muted hover:bg-surface hover:text-ink transition-colors'
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Command Palette Search Button */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              title="Quick Search (Ctrl+K or ⌘K)"
              aria-label="Quick Search (Ctrl+K or ⌘K)"
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink hover:border-brand/40 transition-colors shadow-2xs"
            >
              <Search className="h-3.5 w-3.5 text-muted" />
              <span className="hidden md:inline">Quick Search…</span>
              <kbd className="hidden sm:inline-block rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] font-mono text-muted shadow-2xs">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={openTour}
              title="Open Guided Tour"
              aria-label="Open Guided Tour"
              className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-muted hover:text-brand hover:border-brand transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tour</span>
            </button>

            <ThemeToggle />

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted" aria-live="polite">
              <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />
              <span>{status.text}</span>
            </div>

            {user && (
              <div className="flex items-center gap-2 text-sm pl-1 border-l border-line">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1 text-ink transition-all hover:border-brand hover:bg-panel hover:shadow-xs"
                  title="View Profile & Settings"
                >
                  <span className="max-w-36 truncate font-semibold">
                    {user.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${ROLE_BADGE[user.role]}`}>
                    {user.role}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="p-1.5 text-muted hover:text-fail rounded-md transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 flex-1 w-full">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 border-t border-line text-xs text-muted w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>
          <span className="font-semibold text-ink">ClauseTrace</span> · AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.
        </p>
        <p className="text-[11px]">
          IFSCA Regulatory Framework · GIFT City IFSC · by Team CacheCat
        </p>
      </footer>
    </div>
  )
}
