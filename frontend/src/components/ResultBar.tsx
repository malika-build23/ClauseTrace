import type { ResultCounts } from '../lib/api'
import { RESULT_META, RESULT_ORDER } from '../lib/results'

/**
 * Horizontal stacked bar of result counts. Segments are separated by a 2px
 * surface gap, ends are rounded, and every segment has a hover/focus tooltip.
 * Counts are also printed as text next to the bar, so colour never carries
 * the meaning alone.
 */
export function ResultBar({ counts, label }: { counts: ResultCounts; label: string }) {
  const total = RESULT_ORDER.reduce((n, r) => n + counts[r], 0)
  if (total === 0) return <p className="text-xs text-muted">Not evaluated yet</p>
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`${label}: ${summary(counts)}`}>
        {RESULT_ORDER.filter((r) => counts[r] > 0).map((r) => (
          <div
            key={r}
            tabIndex={0}
            title={`${RESULT_META[r].label}: ${counts[r]} of ${total}`}
            className={`${RESULT_META[r].fill} h-full first:rounded-l last:rounded-r focus:outline-2 focus:outline-offset-1 focus:outline-ink`}
            style={{ width: `${(counts[r] / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-muted">
        {RESULT_ORDER.filter((r) => counts[r] > 0).map((r) => (
          <span key={r}>
            <span aria-hidden>{RESULT_META[r].icon}</span> {counts[r]} {RESULT_META[r].label.toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  )
}

/** Legend shown once above a group of result bars. */
export function ResultLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
      {RESULT_ORDER.map((r) => (
        <li key={r} className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${RESULT_META[r].fill}`} aria-hidden />
          <span aria-hidden>{RESULT_META[r].icon}</span>
          {RESULT_META[r].label}
        </li>
      ))}
    </ul>
  )
}

function summary(counts: ResultCounts) {
  return RESULT_ORDER.map((r) => `${counts[r]} ${RESULT_META[r].label.toLowerCase()}`).join(', ')
}
