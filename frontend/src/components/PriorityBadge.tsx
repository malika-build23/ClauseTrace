const STYLE = {
  high: 'bg-red-50 text-fail',
  medium: 'bg-amber-50 text-upcoming',
  low: 'bg-slate-100 text-insufficient',
} as const

/** Review priority or risk level, always with its label (and reasons on hover/focus). */
export function PriorityBadge({ level, reasons, prefix = 'Priority' }: { level: 'high' | 'medium' | 'low'; reasons?: string[]; prefix?: string }) {
  return (
    <span
      tabIndex={reasons?.length ? 0 : undefined}
      title={reasons?.join('\n')}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${STYLE[level]}`}
    >
      {prefix} {level}
    </span>
  )
}
