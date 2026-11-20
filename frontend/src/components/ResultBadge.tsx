import type { EvaluationResult } from '../lib/api'
import { RESULT_META } from '../lib/results'

/** Status is never colour alone: icon + label + colour. */
export function ResultBadge({ result }: { result: EvaluationResult }) {
  const m = RESULT_META[result]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${m.bg} ${m.text}`}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  )
}
