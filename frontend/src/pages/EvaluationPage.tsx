import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ResultBadge } from '../components/ResultBadge'
import { apiGet, openPdf, type EvaluationRow, type RuleRow } from '../lib/api'
import { ruleSummary } from '../lib/rules'

/**
 * "Why did this result happen?" Every link in the chain, from the stored
 * result back to the regulator's text, using the versions that were active
 * when the result was produced (Block I historical view).
 */
export function EvaluationPage() {
  const { id = '' } = useParams()
  const [ev, setEv] = useState<EvaluationRow | null>(null)
  const [rule, setRule] = useState<RuleRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<EvaluationRow>(`/api/evaluations/${id}`)
      .then(async (e) => {
        setEv(e)
        const history = await apiGet<RuleRow[]>(`/api/rules/history/${encodeURIComponent(e.rule.ruleKey)}`)
        setRule(history.find((r) => r.ruleVersion === e.ruleVersion) ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [id])

  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>
  if (!ev) return <p className="text-sm text-muted">Loading…</p>

  const d = ev.detailsJson
  const step = 'rounded-xl border border-line bg-panel p-5 shadow-sm'

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Overview
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
          Result <ResultBadge result={ev.result} />
          {ev.isSimulation && <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-semibold text-simulation">SIMULATION</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {ev.profile.name} · as of {ev.evaluationDate.slice(0, 10)} · computed {new Date(ev.evaluatedAt).toLocaleString()}
        </p>
      </div>

      <ol className="space-y-4">
        <li className={step}>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">1 · Result</p>
          <p className="mt-2 text-sm">{d.explanation}</p>
          <p className="mt-2 text-xs text-muted">Inputs used (copied at evaluation time, so later edits to the profile do not change this record):</p>
          <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 text-xs">{JSON.stringify(ev.inputRef, null, 2)}</pre>
        </li>

        <li className={step}>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">2 · Rule (deterministic, no AI)</p>
          <p className="mt-2 font-mono text-sm">{ruleSummary(ev.rule.definitionJson)}</p>
          <p className="mt-1 text-xs text-muted">
            <Link to={`/rules?key=${encodeURIComponent(ev.rule.ruleKey)}&all=true`} className="text-brand hover:underline">
              {ev.rule.ruleKey} version {ev.ruleVersion}
            </Link>
            {rule && <> · compiled by {rule.createdBy.name} on {new Date(rule.createdAt).toLocaleString()}</>}
            {!ev.rule.isActive && ' · this version has since been replaced'}
          </p>
        </li>

        <li className={step}>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">3 · Approved obligation</p>
          <p className="mt-2 text-sm">
            <Link to={rule ? `/obligations/${rule.obligation.id}` : '#'} className="font-mono text-brand hover:underline">
              {d.obligation.key}
            </Link>{' '}
            version {d.obligation.version}
            {d.obligation.approvedBy && <> · approved by {d.obligation.approvedBy}</>}
          </p>
          {rule && (
            <p className="mt-1 text-sm">
              <span className="font-medium">{rule.obligation.subject}</span> — {rule.obligation.action}
            </p>
          )}
        </li>

        <li className={step}>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">4 · Source text</p>
          <blockquote className="mt-2 border-l-4 border-yellow-300 bg-yellow-50 px-3 py-2 text-sm">“{d.obligation.quote}”</blockquote>
          <p className="mt-2 text-sm">
            <Link to={`/documents/${d.source.documentId}?version=${d.source.documentVersion}`} className="text-brand hover:underline">
              {d.source.document}
            </Link>
            <span className="text-muted">
              {' '}
              · version {d.source.documentVersion} · clause {d.source.clause} ·{' '}
            </span>
            <button
              type="button"
              className="text-brand underline"
              onClick={() => openPdf(d.source.documentId, d.source.documentVersion, d.source.page).catch((err: Error) => setError(err.message))}
            >
              page {d.source.page}
            </button>
          </p>
        </li>
      </ol>
      <p className="text-sm">
        <Link to={`/audit?objectId=${ev.id}`} className="text-brand hover:underline">
          Audit entries for this result
        </Link>
      </p>
    </div>
  )
}
