import { useEffect, useState } from 'react'
import { ApiError, apiGet, apiPost, type ExtractionRun, type ExtractionState } from '../lib/api'

type Props = {
  documentId: string
  versionNo: number
  canExtract: boolean // version is parsed
  allowed: boolean // user has the reviewer role
  /** Called when a run finishes so the page can reload obligations. */
  onFinished: () => void
}

const active = (run: ExtractionRun | null) => run?.status === 'queued' || run?.status === 'running'

export function ExtractionPanel({ documentId, versionNo, canExtract, allowed, onFinished }: Props) {
  const [run, setRun] = useState<ExtractionRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [showRejections, setShowRejections] = useState(false)

  // Load the latest run, then poll every 3 s while it is active.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasActive = false
    const tick = async () => {
      try {
        const state = await apiGet<ExtractionState>(`/api/documents/${documentId}/extraction?version=${versionNo}`)
        if (cancelled) return
        setRun(state.run)
        const isActive = active(state.run)
        if (wasActive && !isActive) onFinished()
        wasActive = isActive
        if (isActive) timer = setTimeout(tick, 3000)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `starting` re-arms polling after a new run is created.
  }, [documentId, versionNo, starting, onFinished])

  async function start() {
    setError(null)
    setStarting(true)
    try {
      await apiPost(`/api/documents/${documentId}/extract`, { versionNo })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start extraction')
    } finally {
      setStarting(false)
    }
  }

  const busy = starting || active(run)
  const pct = run && run.totalClauses > 0 ? Math.round((run.processedClauses / run.totalClauses) * 100) : 0

  return (
    <section aria-labelledby="extraction-heading" className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="extraction-heading" className="font-medium">
            AI obligation extraction
          </h2>
          <p className="mt-1 text-sm text-muted">
            Gemini proposes obligations clause by clause. Each one must quote the clause exactly, or it is rejected.
            Nothing is final until a reviewer approves it.
          </p>
        </div>
        {allowed && (
        <button
          type="button"
          onClick={start}
          disabled={!canExtract || busy}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Extracting…' : run ? 'Extract again' : 'Extract obligations'}
        </button>
        )}
      </div>

      <div aria-live="polite" className="mt-4 space-y-2 text-sm">
        {!canExtract && <p className="text-muted">Parse the document before extracting obligations.</p>}
        {!allowed && !run && <p className="text-muted">No extraction has been run yet. A reviewer can start one.</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-fail">{error}</p>}

        {run && active(run) && (
          <div>
            <div className="mb-1 flex justify-between text-muted">
              <span>
                {run.status === 'queued' ? 'Starting…' : `Clauses processed: ${run.processedClauses} of ${run.totalClauses}`}
              </span>
              <span>{run.obligationsCreated} obligations so far</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              Free-tier AI can take several minutes. Keep this page open: it also keeps the free server awake.
            </p>
          </div>
        )}

        {run && run.status === 'completed' && (
          <p className="text-muted">
            Last run: <span className="font-medium text-ink">{run.obligationsCreated} new obligations</span> from{' '}
            {run.totalClauses} clauses ({run.cachedClauses} from cache, {run.skippedClauses} skipped as definitions,
            headings or already extracted)
            {run.models && <> · model: {run.models}</>}
            {run.finishedAt && <> · {new Date(run.finishedAt).toLocaleString()}</>}
          </p>
        )}
        {run && run.status === 'failed' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-fail">
            Last run failed: {run.error ?? 'unknown error'}. Obligations saved before the failure are kept; extracting
            again continues with the remaining clauses.
          </p>
        )}

        {run && run.rejectedCount > 0 && !active(run) && (
          <div>
            <button
              type="button"
              onClick={() => setShowRejections((s) => !s)}
              aria-expanded={showRejections}
              className="text-xs text-upcoming underline"
            >
              {run.rejectedCount} model output(s) failed validation and were not saved
            </button>
            {showRejections && (
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {run.rejectionsJson.map((r, i) => (
                  <li key={i}>
                    <span className="font-mono">{r.clause}</span>: {r.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
