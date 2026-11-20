import { Link } from 'react-router'
import { ArrowRight, Calendar } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { ResultBadge } from '../ui/ResultBadge'
import type { EvaluationResult } from '../../lib/api'

export interface SelectedHeatmapCell {
  entityId: string
  entityName: string
  entityCategory: string
  ruleKey: string
  ruleType: string
  ruleVersion: number
  ruleSummaryText: string
  evaluationId?: string
  result: EvaluationResult | 'NOT_EVALUATED'
  explanation?: string
  inputsUsed?: Record<string, unknown>
  evaluatedAt?: string
}

export function HeatmapDrawer({
  selected,
  onClose,
}: {
  selected: SelectedHeatmapCell | null
  onClose: () => void
}) {
  if (!selected) return null

  return (
    <Drawer
      isOpen={Boolean(selected)}
      onClose={onClose}
      title="Compliance Evaluation Drill-Down"
      description={`${selected.entityName} · ${selected.ruleKey} (v${selected.ruleVersion})`}
    >
      <div className="space-y-5 text-sm">
        {/* Status Header Banner */}
        <div className="rounded-xl border border-line bg-surface p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Evaluation Outcome</span>
            <div className="mt-1">
              {selected.result === 'NOT_EVALUATED' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted font-medium">
                  Not Evaluated
                </span>
              ) : (
                <ResultBadge result={selected.result} />
              )}
            </div>
          </div>

          {selected.evaluatedAt && (
            <div className="text-right text-xs text-muted">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(selected.evaluatedAt).toLocaleDateString()}</span>
              </span>
            </div>
          )}
        </div>

        {/* Entity & Rule Meta */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-panel p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Regulated Entity</span>
            <p className="text-sm font-semibold text-ink">{selected.entityName}</p>
            <p className="text-xs text-muted">{selected.entityCategory}</p>
          </div>

          <div className="rounded-xl border border-line bg-panel p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Rule Definition</span>
            <p className="text-xs font-mono font-bold text-brand">{selected.ruleKey}</p>
            <p className="text-xs text-muted capitalize">Template: {selected.ruleType}</p>
          </div>
        </div>

        {/* Rule Summary */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">Rule Condition</span>
          <p className="rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink leading-relaxed">
            {selected.ruleSummaryText}
          </p>
        </div>

        {/* Detailed Explanation */}
        {selected.explanation && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Deterministic Explanation</span>
            <p className="rounded-xl border border-line bg-surface p-3 text-xs text-ink leading-relaxed">
              {selected.explanation}
            </p>
          </div>
        )}

        {/* Frozen Inputs Used */}
        {selected.inputsUsed && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Inputs Used at Evaluation Time</span>
            <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-3 text-xs font-mono text-ink">
              {JSON.stringify(selected.inputsUsed, null, 2)}
            </pre>
            <p className="text-[11px] text-muted">
              Inputs were frozen during evaluation. Subsequent edits to profile balance sheets do not retroactively alter this record.
            </p>
          </div>
        )}

        {/* Action Link to Full Traceability Chain */}
        {selected.evaluationId && (
          <div className="pt-3 border-t border-line">
            <Link
              to={`/evaluations/${selected.evaluationId}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-hover transition-colors"
            >
              <span>View Full Traceability Chain</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </Drawer>
  )
}
