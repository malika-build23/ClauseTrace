import { useEffect, useState } from 'react'
import { apiGet, type Health } from './lib/api'

type State =
  | { kind: 'loading'; slow: boolean }
  | { kind: 'ok'; health: Health }
  | { kind: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading', slow: false })

  useEffect(() => {
    // Free-tier backends sleep when idle; tell the user instead of looking broken.
    const slowTimer = setTimeout(() => setState((s) => (s.kind === 'loading' ? { kind: 'loading', slow: true } : s)), 3000)
    apiGet<Health>('/api/health')
      .then((health) => setState({ kind: 'ok', health }))
      .catch((err: Error) => setState({ kind: 'error', message: err.message }))
      .finally(() => clearTimeout(slowTimer))
    return () => clearTimeout(slowTimer)
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">ClauseTrace</h1>
        <p className="text-muted">AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.</p>
      </header>

      <section className="rounded-xl border border-line bg-panel p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">System status</h2>
        <div className="mt-3" aria-live="polite">
          {state.kind === 'loading' && (
            <p className="text-muted">{state.slow ? 'Waking up the server… this can take up to a minute on free hosting.' : 'Checking backend…'}</p>
          )}
          {state.kind === 'ok' && (
            <p className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-pass" aria-hidden />
              Backend {state.health.status}, database {state.health.db}
            </p>
          )}
          {state.kind === 'error' && (
            <p className="flex items-center gap-2 text-fail">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-fail" aria-hidden />
              Backend unreachable ({state.message})
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
