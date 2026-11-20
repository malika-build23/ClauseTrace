import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PriorityBadge } from '../components/PriorityBadge'
import { ResultBadge } from '../components/ResultBadge'
import { ResultBar, ResultLegend } from '../components/ResultBar'
import { RiskSettings } from '../components/RiskSettings'
import { apiGet, type DashboardSummary } from '../lib/api'
import { RESULT_META, RESULT_ORDER } from '../lib/results'

function Stat({ label, value, to, hint }: { label: string; value: number | string; to?: string; hint?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#586b66]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[#2C3531]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#be7534]">{hint}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="block rounded-xl border border-[#D1E8E2] bg-white p-4 shadow-2xs transition-all hover:border-[#116466] hover:shadow-sm">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-[#D1E8E2] bg-white p-4 shadow-2xs">{body}</div>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    apiGet<DashboardSummary>('/api/dashboard/summary')
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [])
  useEffect(load, [load])

  if (error) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>

  const o = data.obligations
  const reviewed = o.approved + o.edited + o.rejected
  const totalObligations = reviewed + o.proposed
  const checks = RESULT_ORDER.reduce((n, r) => n + data.results[r], 0)

  return (
    <div className="space-y-6">
      {/* Top Branded Banner with Illustration */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D1E8E2] bg-gradient-to-r from-white via-[#F5FAF8] to-[#E6F3F0] p-6 shadow-sm">
        <div className="flex flex-col-reverse justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2 md:max-w-xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#D9B08C] bg-[#F8EFE6] px-2.5 py-0.5 text-xs font-semibold text-[#8C5828]">
                GIFT IFSC Framework
              </span>
              <span className="rounded-full border border-[#D1E8E2] bg-white px-2.5 py-0.5 text-xs font-semibold text-[#116466]">
                FME Obligations
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#2C3531] sm:text-3xl">
              Compliance Intelligence Overview
            </h1>
            <p className="text-sm font-medium leading-relaxed text-[#586b66]">
              Real-time monitoring of approved IFSCA obligations, versioned deterministic rules, and entity compliance results with end-to-end audit traceability.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <img
              src="/images/hero-regtech.png"
              alt="Compliance Automation"
              className="h-28 w-auto object-contain drop-shadow-md sm:h-36"
            />
          </div>
        </div>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Documents" value={data.documents} to="/documents" />
        <Stat label="To review" value={o.proposed} to="/review" hint={o.ambiguousProposed ? `${o.ambiguousProposed} ambiguous` : undefined} />
        <Stat label="Approved obligations" value={o.approved + o.edited} to="/review?status=approved" hint={o.edited ? `${o.edited} with edits` : undefined} />
        <Stat label="Active rules" value={data.rules.active} to="/rules" />
        <Stat label="Checks failing" value={data.results.FAIL} hint={`of ${checks} checks`} />
        <Stat label="Upcoming deadlines" value={data.results.UPCOMING_DEADLINE} />
      </section>

      <section aria-labelledby="review-progress" className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <h2 id="review-progress" className="font-medium">
          Review progress
        </h2>
        <p className="mt-1 text-sm text-muted">
          {reviewed} of {totalObligations} AI-proposed obligations reviewed by a person ({o.rejected} rejected).
        </p>
        {totalObligations > 0 && (
          <div
            className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded"
            role="img"
            aria-label={`${o.approved + o.edited} approved, ${o.rejected} rejected, ${o.proposed} not reviewed`}
          >
            {[
              { n: o.approved + o.edited, cls: 'bg-brand', label: 'Approved' },
              { n: o.rejected, cls: 'bg-slate-400', label: 'Rejected' },
              { n: o.proposed, cls: 'bg-slate-200', label: 'Not reviewed' },
            ]
              .filter((s) => s.n > 0)
              .map((s) => (
                <div key={s.label} title={`${s.label}: ${s.n}`} className={`${s.cls} h-full first:rounded-l last:rounded-r`} style={{ width: `${(s.n / totalObligations) * 100}%` }} />
              ))}
          </div>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand align-middle" aria-hidden />
            Approved {o.approved + o.edited}
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-400 align-middle" aria-hidden />
            Rejected {o.rejected}
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-200 align-middle" aria-hidden />
            Not reviewed {o.proposed}
          </span>
        </p>
      </section>

      <section aria-labelledby="by-entity" className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="by-entity" className="font-medium">
            Results by entity
          </h2>
          <ResultLegend />
        </div>
        {data.profiles.length === 0 && <p className="mt-3 text-sm text-muted">No entity profiles yet.</p>}
        <ul className="mt-4 space-y-4">
          {data.profiles.map((p) => (
            <li key={p.id} className="grid gap-2 sm:grid-cols-[16rem_minmax(0,1fr)] sm:items-center">
              <Link to={`/profiles?id=${p.id}`} className="truncate text-sm text-brand hover:underline" title={p.name}>
                {p.name}
              </Link>
              <ResultBar counts={p.counts} label={p.name} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="attention" className="rounded-xl border border-line bg-panel shadow-sm">
        <h2 id="attention" className="border-b border-line px-5 py-3 font-medium">
          Needs attention <span className="text-sm font-normal text-muted">· highest risk first</span>
        </h2>
        {data.attention.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            {checks === 0 ? 'No evaluations yet. Compile rules and evaluate a profile.' : 'Every latest check passes and no source changes are waiting.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-xs text-muted uppercase">
                <tr>
                  <th className="px-5 py-2 font-medium">Risk</th>
                  <th className="px-5 py-2 font-medium">Result</th>
                  <th className="px-5 py-2 font-medium">Entity</th>
                  <th className="px-5 py-2 font-medium">Why</th>
                  <th className="px-5 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.attention.map((a) => (
                  <tr key={a.evaluationId}>
                    <td className="px-5 py-2 align-top">
                      <PriorityBadge level={a.risk.level} reasons={a.risk.reasons} prefix="Risk" />
                      <p className="mt-1 text-[11px] text-muted">{a.risk.reasons.join('; ')}</p>
                    </td>
                    <td className="px-5 py-2 align-top">
                      <Link to={`/evaluations/${a.evaluationId}`} aria-label={`${RESULT_META[a.result].label}: open details`}>
                        <ResultBadge result={a.result} />
                      </Link>
                    </td>
                    <td className="px-5 py-2 align-top text-xs">{a.profileName}</td>
                    <td className="px-5 py-2 align-top text-xs">{a.details.explanation}</td>
                    <td className="px-5 py-2 align-top text-xs text-muted">
                      {a.details.source.document} · clause {a.details.source.clause} · p. {a.details.source.page}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RiskSettings key={JSON.stringify(data.riskWeights)} weights={data.riskWeights} onSaved={load} />
    </div>
  )
}
