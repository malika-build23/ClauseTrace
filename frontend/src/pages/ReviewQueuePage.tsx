import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PriorityBadge } from '../components/PriorityBadge'
import { ModalityBadge } from '../components/ui/ModalityBadge'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { apiGet, type ObligationListItem, type ObligationStatus } from '../lib/api'

const STATUS_TABS: { value: ObligationStatus | 'all'; label: string }[] = [
  { value: 'proposed', label: 'To Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'edited', label: 'Approved with Edits' },
  { value: 'rejected', label: 'Rejected' },
]

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
    <div className="space-y-6">
      <PageHeader
        title="Human Review Queue"
        description="Compliance officers triage AI-proposed obligations. Prioritized by risk and ambiguity; nothing becomes an enforceable rule until approved here with verified source quotes."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1 rounded-xl bg-surface border border-line p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => set({ status: t.value })}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                status === t.value
                  ? 'bg-panel text-brand shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-line text-brand focus:ring-brand"
            checked={ambiguousOnly}
            onChange={(e) => set({ ambiguous: e.target.checked ? 'true' : null })}
          />
          <span>Ambiguous proposals only</span>
        </label>
      </div>

      {error && <ErrorState message={error} />}

      {!items && !error && (
        <div className="rounded-xl border border-line bg-panel p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-5 w-20" variant="circular" />
            </div>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState
          title="No obligations found"
          description={status === 'proposed' ? 'Run an AI extraction run on an uploaded document to propose obligations.' : 'No obligations match the selected status filter.'}
        />
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
          {items.map((o, i) => (
            <li key={o.id} className="transition-colors hover:bg-surface/50">
              <Link
                to={`/obligations/${o.id}${status === 'proposed' ? `?queue=${i}` : ''}`}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5 focus:bg-surface focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ModalityBadge modality={o.modality} />
                    <span className="text-sm font-semibold text-ink">{o.subject}</span>
                    <span className="text-sm text-muted">— {o.action}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {o.clause.documentVersion.document.title} · v{o.clause.documentVersion.versionNo} · clause{' '}
                    <span className="font-semibold text-ink">{o.clause.clauseNumber}</span> · p.{' '}
                    {o.clause.page} · <span className="font-mono text-brand">{o.obligationKey}</span>
                    {o.version > 1 && ` · v${o.version}`}
                  </p>
                  {o.priorityReasons?.length > 0 && o.reviewPriority !== 'low' && (
                    <p className="mt-1 text-[11px] text-muted">Priority: {o.priorityReasons.join('; ')}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                  {o.reviewPriority && <PriorityBadge level={o.reviewPriority} reasons={o.priorityReasons} />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
