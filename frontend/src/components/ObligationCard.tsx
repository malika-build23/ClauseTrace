import { Link } from 'react-router'
import { ModalityBadge } from './ui/ModalityBadge'
import { StatusBadge } from './ui/StatusBadge'
import type { Obligation } from '../lib/api'

const OPERATOR_TEXT: Record<string, string> = { '>=': '≥', '<=': '≤', '==': '=', '!=': '≠', '>': '>', '<': '<' }

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : String(value)
}

export function ObligationCard({ ob }: { ob: Obligation }) {
  const t = ob.thresholdJson
  return (
    <article className="rounded-xl border border-line bg-surface p-4 text-sm shadow-2xs space-y-3" aria-label={`Obligation ${ob.obligationKey}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ModalityBadge modality={ob.modality} />
          <Link to={`/obligations/${ob.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
            {ob.obligationKey}
          </Link>
        </div>
        <StatusBadge status={ob.status} />
      </div>

      <p className="text-sm font-medium text-ink">
        <span className="font-bold">{ob.subject}</span> — {ob.action}
      </p>

      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr] bg-panel p-2.5 rounded-lg border border-line">
        {ob.condition && (
          <>
            <dt className="text-muted font-medium">Condition:</dt>
            <dd className="text-ink">{ob.condition}</dd>
          </>
        )}
        {t && (
          <>
            <dt className="text-muted font-medium">Threshold:</dt>
            <dd className="font-mono font-semibold text-ink">
              {t.metric} {OPERATOR_TEXT[t.operator] ?? t.operator} {formatValue(t.value)} {t.unit ?? ''}
            </dd>
          </>
        )}
        {ob.deadline && (
          <>
            <dt className="text-muted font-medium">Deadline:</dt>
            <dd className="text-ink font-semibold">{ob.deadline.slice(0, 10)}</dd>
          </>
        )}
        {ob.evidence && (
          <>
            <dt className="text-muted font-medium">Evidence:</dt>
            <dd className="text-ink">{ob.evidence}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {ob.machineCheckable ? (
          <span className="rounded bg-pass-bg text-pass px-2 py-0.5 border border-pass-border font-medium">
            Machine-checkable
          </span>
        ) : (
          <span className="rounded bg-surface text-muted px-2 py-0.5 border border-line">
            Reference only (not machine-checkable)
          </span>
        )}
        {ob.ambiguityFlag && (
          <span className="rounded bg-upcoming-bg text-upcoming px-2 py-0.5 border border-upcoming-border font-medium" title={ob.ambiguityReason ?? undefined}>
            ⚠ Ambiguous{ob.ambiguityReason ? `: ${ob.ambiguityReason}` : ''}
          </span>
        )}
        {ob.confidence !== null && (
          <span className="text-muted ml-auto" title="Model-reported confidence. A review aid, not proof of correctness.">
            Confidence: {Math.round(ob.confidence * 100)}%
          </span>
        )}
      </div>
    </article>
  )
}
