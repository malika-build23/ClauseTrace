import { Link } from 'react-router'
import { ArrowRight, CheckCircle2, ChevronRight, Eye, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import { ResultBadge } from '../ui/ResultBadge'
import { StatusBadge } from '../ui/StatusBadge'
import { RESULT_ORDER } from '../../lib/results'
import type { ChangeEvent, EvaluationResult, ImpactItem } from '../../lib/api'

export interface BlastRadiusViewProps {
  change: ChangeEvent
  canEdit: boolean
  onSetImpact: (item: ImpactItem, reviewStatus: ImpactItem['reviewStatus']) => void
  onSetChangeStatus?: (status: ChangeEvent['status']) => void
}

export function BlastRadiusView({
  change,
  canEdit,
  onSetImpact,
  onSetChangeStatus,
}: BlastRadiusViewProps) {
  const impacts = change.impactItems ?? []

  // Calculate blast radius aggregates
  const totalObligations = new Set(impacts.map((i) => i.obligation?.id).filter(Boolean)).size
  const totalRules = new Set(impacts.map((i) => i.rule?.id).filter(Boolean)).size

  const resultCounts: Record<EvaluationResult, number> = {
    FAIL: 0,
    UPCOMING_DEADLINE: 0,
    INSUFFICIENT_DATA: 0,
    PASS: 0,
  }

  for (const item of impacts) {
    for (const res of RESULT_ORDER) {
      if (item.evaluations[res]) {
        resultCounts[res] += item.evaluations[res]!
      }
    }
  }

  const totalEvaluations = Object.values(resultCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {/* ─── Governance Notice Banner (Principle 1) ─────────────────────────── */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50/90 p-4 shadow-sm dark:border-amber-600 dark:bg-amber-950/40">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Approved rules do not change automatically. Review required.
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              When regulatory amendments modify or repeal source clauses, existing approved
              rules and active evaluations remain locked to their approved historical baseline.
              A qualified compliance reviewer must inspect the blast radius and manually approve
              any updates.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Blast Radius Summary Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-medium text-muted uppercase">Clause Target</p>
          <p className="mt-1 text-lg font-bold font-mono text-ink">{change.clauseRef}</p>
          <span className="text-[10px] text-muted capitalize">{change.changeType} amendment</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-medium text-muted uppercase">Affected Obligations</p>
          <p className="mt-1 text-lg font-bold text-teal">{totalObligations}</p>
          <span className="text-[10px] text-muted">Awaiting re-verification</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-medium text-muted uppercase">Impacted Rules</p>
          <p className="mt-1 text-lg font-bold text-amber-600">{totalRules}</p>
          <span className="text-[10px] text-muted">Deterministic logic ASTs</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-medium text-muted uppercase">Entity Evaluations</p>
          <p className="mt-1 text-lg font-bold text-simulation">{totalEvaluations}</p>
          <span className="text-[10px] text-muted">Historical determinations</span>
        </div>
      </div>

      {/* ─── Staged Cascade Animation Visualization ─────────────────────────── */}
      <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal" />
          Amendment Blast Radius Cascade
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
          {/* Step 1: Clause */}
          <div className="flex-1 rounded-lg border border-line bg-surface p-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-medium text-muted uppercase block">1. Changed Clause</span>
              <p className="font-semibold text-sm font-mono mt-0.5 text-ink">{change.clauseRef}</p>
            </div>
            <p className="text-[11px] text-muted mt-2 line-clamp-2">{change.summary}</p>
          </div>

          <div className="hidden sm:flex items-center justify-center text-muted px-1">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Step 2: Obligations */}
          <div className="flex-1 rounded-lg border border-line bg-surface p-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-medium text-muted uppercase block">2. Obligations</span>
              <p className="font-semibold text-sm mt-0.5 text-teal">{totalObligations} Obligation(s)</p>
            </div>
            <p className="text-[11px] text-muted mt-2">
              Extracted regulatory requirements attached to this clause
            </p>
          </div>

          <div className="hidden sm:flex items-center justify-center text-muted px-1">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Step 3: Rules */}
          <div className="flex-1 rounded-lg border border-line bg-surface p-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-medium text-muted uppercase block">3. Compiled Rules</span>
              <p className="font-semibold text-sm mt-0.5 text-amber-600">{totalRules} Active Rule(s)</p>
            </div>
            <p className="text-[11px] text-muted mt-2">
              Executable compliance rules derived from obligations
            </p>
          </div>

          <div className="hidden sm:flex items-center justify-center text-muted px-1">
            <ArrowRight className="h-4 w-4" />
          </div>

          {/* Step 4: Evaluations */}
          <div className="flex-1 rounded-lg border border-line bg-surface p-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-medium text-muted uppercase block">4. Live Impact</span>
              <p className="font-semibold text-sm mt-0.5 text-simulation">{totalEvaluations} Result(s)</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {RESULT_ORDER.map((res) =>
                resultCounts[res] > 0 ? (
                  <span
                    key={res}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-panel border border-line"
                  >
                    <ResultBadge result={res} />
                    <span>{resultCounts[res]}</span>
                  </span>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detailed Impact Items List with Review Links ───────────────────── */}
      <div className="rounded-xl border border-line bg-panel p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Impacted Lineage Records & Review Queue
          </p>
          <span className="text-xs text-muted">
            {impacts.length} item{impacts.length === 1 ? '' : 's'} linked
          </span>
        </div>

        {impacts.length === 0 ? (
          <p className="text-xs text-muted py-2">
            No downstream obligations or active rules are currently compiled for this clause.
          </p>
        ) : (
          <div className="space-y-3">
            {impacts.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-line bg-surface/60 p-3 space-y-2 hover:border-brand/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.obligation && (
                      <Link
                        to={`/obligations/${item.obligation.id}`}
                        className="font-mono text-xs font-medium text-brand hover:underline flex items-center gap-1"
                      >
                        {item.obligation.obligationKey} (v{item.obligation.version})
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {item.obligation && <StatusBadge status={item.obligation.status} />}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded bg-panel border border-line px-2 py-0.5 text-[11px] font-medium capitalize">
                      {item.reviewStatus.replace('_', ' ')}
                    </span>
                    {canEdit && item.reviewStatus === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSetImpact(item, 'confirmed')}
                          className="inline-flex items-center gap-1 rounded bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal hover:bg-teal/20 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetImpact(item, 'dismissed')}
                          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-muted hover:bg-gray-200 transition-colors dark:bg-gray-800"
                        >
                          <XCircle className="h-3 w-3" /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {item.obligation && (
                  <p className="text-xs text-ink">
                    <strong className="text-muted">{item.obligation.subject}:</strong> {item.obligation.action}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/60 text-xs text-muted">
                  {item.rule ? (
                    <div className="flex items-center gap-2">
                      <span>Compiled Rule:</span>
                      <Link
                        to={`/rules?key=${encodeURIComponent(item.rule.ruleKey)}`}
                        className="font-mono text-brand hover:underline"
                      >
                        {item.rule.ruleKey} (v{item.rule.ruleVersion})
                      </Link>
                      <span className="text-[10px]">
                        ({item.rule.isActive ? 'Active' : 'Superseded'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] italic text-muted">No compiled rule attached</span>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {item.obligation && (
                      <Link
                        to={`/review?key=${encodeURIComponent(item.obligation.obligationKey)}`}
                        className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                      >
                        <Eye className="h-3 w-3" />
                        Open in Review Queue
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Change event decision controls */}
        {canEdit && onSetChangeStatus && change.status === 'pending' && (
          <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-xs text-muted">
              Clause Change Decision:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSetChangeStatus('confirmed')}
                className="rounded-lg bg-teal px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-hover transition-colors"
              >
                Confirm Amendment Change
              </button>
              <button
                type="button"
                onClick={() => onSetChangeStatus('dismissed')}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                Dismiss Change
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
