import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { apiGet, type Health } from '../lib/api'

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

export function Layout() {
  const status = STATUS_TEXT[useBackendStatus()]
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              ClauseTrace
            </Link>
            <nav className="flex gap-4 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) => (isActive ? 'font-medium text-brand' : 'text-muted hover:text-ink')}
              >
                Documents
              </NavLink>
            </nav>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
            <span className={`inline-block h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
            {status.text}
          </p>
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
