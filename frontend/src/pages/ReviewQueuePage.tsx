import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PriorityBadge } from '../components/PriorityBadge'
import { apiGet, type ObligationListItem, type ObligationStatus } from '../lib/api'

const STATUS_TABS: { value: ObligationStatus | 'all'; label: string }[] = [
  { value: 'proposed', label: 'To review' },
  { value: 'approved', label: 'Approved' },
  { value: 'edited', label: 'Edited & approved' },
  { value: 'rejected', label: 'Rejected' },
]

const MODALITY_LABEL = { must: 'MUST', must_not: 'MUST NOT', should: 'SHOULD', may: 'MAY' } as const

export function ReviewQueuePage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'proposed') as ObligationStatus
  const ambiguousOnly = params.get('ambiguous') === 'true'
  const [items, setItems] = useState<ObligationListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setItems(null)
    const q = new URLSearchParams({ status, limit: '500', ...(ambiguousOnly ? { ambiguous: 'true' } : {}) })
    apiGet<ObligationListItem[]>(`/api/obligations?${q}`)
      .then(setItems)
      .catch((err: Error) => setError(err.message))
  }, [status, ambiguousOnly])

  const set = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="mt-1 text-sm text-muted">
          Highest review priority first (reasons on each item), then ambiguous and lowest confidence. Priority says where to look first, not whether the AI is right. Nothing becomes a rule until it is approved here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => set({ status: t.value })}
              className={`rounded-md px-3 py-1.5 text-sm ${status === t.value ? 'bg-panel font-medium shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={ambiguousOnly} onChange={(e) => set({ ambiguous: e.target.checked ? 'true' : null })} />
          Ambiguous only
        </label>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
      {!items && !error && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nothing here. {status === 'proposed' ? 'Run an extraction on a document to propose obligations.' : ''}
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
          {items.map((o, i) => (
            <li key={o.id}>
              <Link
                to={`/obligations/${o.id}${status === 'proposed' ? `?queue=${i}` : ''}`}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface focus:bg-surface focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold">{MODALITY_LABEL[o.modality]}</span>
                    <span className="font-medium">{o.subject}</span> — {o.action}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {o.clause.documentVersion.document.title} · v{o.clause.documentVersion.versionNo} · clause {o.clause.clauseNumber} · p.{' '}
                    {o.clause.page} · <span className="font-mono">{o.obligationKey}</span>
                    {o.version > 1 && ` · version ${o.version}`}
                  </p>
                  {o.priorityReasons?.length > 0 && o.reviewPriority !== 'low' && <p className="mt-0.5 text-[11px] text-muted">Why: {o.priorityReasons.join('; ')}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px]">
                  {o.reviewPriority && <PriorityBadge level={o.reviewPriority} reasons={o.priorityReasons} />}
                  {o.ambiguityFlag && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-upcoming">⚠ Ambiguous</span>}
                  {o.machineCheckable && <span className="rounded bg-green-50 px-1.5 py-0.5 text-pass">Machine-checkable</span>}
                  {o.referenceOnly && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-insufficient">Reference only</span>}
                  {o.confidence !== null && <span className="text-muted">{Math.round(o.confidence * 100)}%</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
