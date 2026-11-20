import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Deterministic checks compiled from approved, machine-checkable obligations by fixed templates (no AI). Rules are never
            edited: a change creates a new version and the old one stays on record.
          </p>
        </div>
        {can('reviewer') && (
          <button
            type="button"
            onClick={runCompile}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-[#0c4d4f] transition-colors disabled:opacity-50"
          >
            {busy ? 'Compiling…' : 'Compile approved obligations'}
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
      {compile && (
        <div className="rounded-md border border-line bg-panel px-4 py-3 text-sm" aria-live="polite">
          <p>
            <b>{compile.summary.created}</b> new rules, <b>{compile.summary.newVersion}</b> new versions, {compile.summary.unchanged} unchanged,{' '}
            {compile.summary.skipped} skipped.
          </p>
          {compile.summary.skipped > 0 && (
            <details className="mt-1 text-xs text-muted">
              <summary className="cursor-pointer">Why were some skipped?</summary>
              <ul className="mt-1 space-y-0.5">
                {compile.outcomes
                  .filter((o) => o.outcome === 'skipped')
                  .map((o) => (
                    <li key={o.obligationId}>
                      <Link className="font-mono text-brand" to={`/obligations/${o.obligationId}`}>
                        {o.obligationKey}
                      </Link>
                      : {o.reason}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={showAll} onChange={(e) => setParams(e.target.checked ? { all: 'true' } : {})} />
        Show inactive (older) versions
      </label>

      {!rules && !error && <p className="text-sm text-muted">Loading…</p>}
      {rules && rules.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No rules yet. Approve machine-checkable obligations in the review queue, then compile.
        </p>
      )}
      {rules && rules.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Rule</th>
                <th className="px-4 py-2 font-medium">Check</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rules.map((r) => {
                const c = r.obligation.clause
                return (
                  <tr key={r.id} className={highlight === r.ruleKey ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-mono text-xs">{r.ruleKey}</p>
                      <p className="text-xs text-muted">
                        v{r.ruleVersion} · {r.type} · by {r.createdBy.name}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs">{ruleSummary(r.definitionJson)}</td>
                    <td className="px-4 py-3 align-top text-xs">
                      <Link className="text-brand hover:underline" to={`/obligations/${r.obligation.id}`}>
                        {r.obligation.obligationKey} v{r.obligation.version}
                      </Link>
                      <p className="text-muted">
                        {c.documentVersion.document.title} · clause {c.clauseNumber} · p. {c.page}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">{r.isActive ? 'Active' : 'Inactive'}</td>
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
