import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiGet, apiPost, apiSend, type ConflictFlag } from '../lib/api'
import { useAuth } from '../lib/auth'

const STATUS_LABEL: Record<ConflictFlag['status'], string> = {
  flagged: 'Flagged, not reviewed',
  confirmed: 'Confirmed conflict',
  resolved: 'Resolved',
  not_a_conflict: 'Not a conflict',
}

function Side({ o }: { o: ConflictFlag['obligationA'] }) {
  const doc = o.clause.documentVersion
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-3 text-sm">
      <Link to={`/obligations/${o.id}`} className="font-mono text-xs text-brand hover:underline">
        {o.obligationKey} v{o.version}
      </Link>
      <span className="ml-2 text-xs text-muted">{o.status}</span>
      <p className="mt-1 text-xs text-muted">
        {doc.document.title} · v{doc.versionNo} · clause {o.clause.clauseNumber} · p. {o.clause.page}
      </p>
      <blockquote className="mt-2 border-l-4 border-yellow-300 pl-2 text-xs">“{o.quote}”</blockquote>
    </div>
  )
}

export function ConflictsPage() {
  const { can } = useAuth()
  const canEdit = can('reviewer')
  const [flags, setFlags] = useState<ConflictFlag[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiGet<ConflictFlag[]>('/api/conflicts')
      .then(setFlags)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  async function scan() {
    setBusy(true)
    setError(null)
    try {
      const r = await apiPost<{ candidates: number; newFlags: number }>('/api/conflicts/scan', {})
      setMessage(`${r.candidates} candidate pair(s) found, ${r.newFlags} new.`)
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function review(flag: ConflictFlag, status: ConflictFlag['status']) {
    await apiSend('PATCH', `/api/conflicts/${flag.id}`, { status }).catch((err: Error) => setError(err.message))
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Possible conflicts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Obligations that set different limits on the same metric. These are flags for a person to check, never a conclusion:
            two limits for different situations (for example two different fees) are normal.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={scan} disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50">
            {busy ? 'Scanning…' : 'Scan obligations'}
          </button>
        )}
      </div>
      <div aria-live="polite">
        {message && <p className="text-sm text-pass">{message}</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
      </div>
      {!flags && !error && <p className="text-sm text-muted">Loading…</p>}
      {flags && flags.length === 0 && <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">No flags. Run a scan after extracting obligations.</p>}
      <ul className="space-y-4">
        {flags?.map((f) => (
          <li key={f.id} className="rounded-xl border border-line bg-panel p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{f.reason}</p>
              <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs">
                {STATUS_LABEL[f.status]}
                {f.reviewedBy && ` · ${f.reviewedBy.name}`}
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Side o={f.obligationA} />
              <Side o={f.obligationB} />
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {(['not_a_conflict', 'confirmed', 'resolved'] as const)
                  .filter((s) => s !== f.status)
                  .map((s) => (
                    <button key={s} type="button" className="text-brand underline" onClick={() => review(f, s)}>
                      Mark: {STATUS_LABEL[s].toLowerCase()}
                    </button>
                  ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
