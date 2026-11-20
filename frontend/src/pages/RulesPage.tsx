import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { apiGet, apiPost, type CompileResponse, type RuleRow } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ruleSummary } from '../lib/rules'

export function RulesPage() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const showAll = params.get('all') === 'true'
  const highlight = params.get('key')
  const [rules, setRules] = useState<RuleRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [compile, setCompile] = useState<CompileResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    apiGet<RuleRow[]>(`/api/rules?active=${showAll ? 'all' : 'true'}`)
      .then(setRules)
      .catch((err: Error) => setError(err.message))
  }, [showAll])
  useEffect(load, [load])

  async function runCompile() {
    setBusy(true)
    setError(null)
    try {
      setCompile(await apiPost<CompileResponse>('/api/rules/compile', {}))
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compiled Rules"
        description="Deterministic compliance checks compiled from approved, machine-checkable obligations by fixed templates (no AI). Rules are immutable: modifications increment version numbers while preserving audit history."
        actions={
          can('reviewer') && (
            <button
              type="button"
              onClick={runCompile}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              <span>{busy ? 'Compiling…' : 'Compile Approved Obligations'}</span>
            </button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {compile && (
        <div className="rounded-xl border border-line bg-panel px-5 py-4 text-sm shadow-xs" aria-live="polite">
          <p className="font-semibold text-ink">
            <b>{compile.summary.created}</b> new rules compiled · <b>{compile.summary.newVersion}</b> new versions ·{' '}
            {compile.summary.unchanged} unchanged · {compile.summary.skipped} skipped.
          </p>
          {compile.summary.skipped > 0 && (
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer font-medium text-brand hover:underline">Why were some skipped?</summary>
              <ul className="mt-1.5 space-y-1">
                {compile.outcomes
                  .filter((o) => o.outcome === 'skipped')
                  .map((o) => (
                    <li key={o.obligationId} className="flex gap-2">
                      <Link className="font-mono font-medium text-brand hover:underline" to={`/obligations/${o.obligationId}`}>
                        {o.obligationKey}
                      </Link>
                      <span>: {o.reason}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-muted cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-line text-brand focus:ring-brand"
            checked={showAll}
            onChange={(e) => setParams(e.target.checked ? { all: 'true' } : {})}
          />
          <span>Show inactive (historical) versions</span>
        </label>
        {rules && (
          <span className="text-xs text-muted font-medium">
            {rules.length} rule{rules.length === 1 ? '' : 's'} displayed
          </span>
        )}
      </div>

      {!rules && !error && (
        <div className="rounded-xl border border-line bg-panel p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {rules && rules.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="No compiled rules yet"
          description="Approve machine-checkable obligations in the review queue, then click 'Compile Approved Obligations'."
        />
      )}

      {rules && rules.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-line bg-surface/50 text-xs font-semibold text-muted uppercase">
              <tr>
                <th className="px-5 py-3">Rule Key</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Logic / Summary</th>
                <th className="px-5 py-3">Source Obligation</th>
                <th className="px-5 py-3">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rules.map((r) => {
                const isSelected = r.ruleKey === highlight
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-brand-light/40 ring-1 ring-brand' : 'hover:bg-surface/40'
                    }`}
                  >
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-ink">
                      {r.ruleKey}
                      {!r.isActive && (
                        <span className="ml-2 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                          archived
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-surface px-2 py-0.5 text-xs font-medium text-muted uppercase tracking-wider">
                        {r.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink max-w-md font-mono">
                      {ruleSummary(r.definitionJson)}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <Link
                        to={`/obligations/${r.obligation.id}`}
                        className="font-mono text-brand font-medium hover:underline"
                      >
                        {r.obligation.obligationKey} v{r.obligation.version}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      v{r.ruleVersion}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
