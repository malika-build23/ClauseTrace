import type { Modality, Obligation } from '../lib/api'

const MODALITY: Record<Modality, { label: string; className: string }> = {
  must: { label: 'MUST', className: 'bg-blue-50 text-brand' },
  must_not: { label: 'MUST NOT', className: 'bg-red-50 text-fail' },
  should: { label: 'SHOULD', className: 'bg-amber-50 text-upcoming' },
  may: { label: 'MAY', className: 'bg-slate-100 text-insufficient' },
}

const OPERATOR_TEXT: Record<string, string> = { '>=': '≥', '<=': '≤', '==': '=', '!=': '≠', '>': '>', '<': '<' }

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : String(value)
}

export function ObligationCard({ ob }: { ob: Obligation }) {
  const modality = MODALITY[ob.modality]
  const t = ob.thresholdJson
  return (
    <article className="rounded-lg border border-line bg-surface p-3 text-sm" aria-label={`Obligation ${ob.obligationKey}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${modality.className}`}>
          {modality.label}
        </span>
        <span className="font-mono text-[11px] text-muted">{ob.obligationKey}</span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-insufficient">
          {ob.status === 'proposed' ? 'Proposed · not reviewed' : ob.status}
        </span>
      </div>

      <p className="mt-2">
        <span className="font-medium">{ob.subject}</span> — {ob.action}
      </p>

      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        {ob.condition && (
          <>
            <dt className="text-muted">Condition</dt>
            <dd>{ob.condition}</dd>
          </>
        )}
        {t && (
          <>
            <dt className="text-muted">Threshold</dt>
            <dd className="font-mono">
              {t.metric} {OPERATOR_TEXT[t.operator] ?? t.operator} {formatValue(t.value)} {t.unit ?? ''}
            </dd>
          </>
        )}
        {ob.deadline && (
          <>
            <dt className="text-muted">Deadline</dt>
            <dd>{ob.deadline.slice(0, 10)}</dd>
          </>
        )}
        {ob.evidence && (
          <>
            <dt className="text-muted">Evidence</dt>
            <dd>{ob.evidence}</dd>
          </>
        )}
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {ob.machineCheckable ? (
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-pass">Machine-checkable</span>
        ) : (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-insufficient">Not machine-checkable</span>
        )}
        {ob.ambiguityFlag && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-upcoming" title={ob.ambiguityReason ?? undefined}>
            ⚠ Ambiguous{ob.ambiguityReason ? `: ${ob.ambiguityReason}` : ''}
          </span>
        )}
        {ob.confidence !== null && (
          <span className="text-muted" title="Model-reported confidence. A review aid, not proof of correctness.">
            Model confidence {Math.round(ob.confidence * 100)}%
          </span>
        )}
      </div>
    </article>
  )
}
