const STYLE = {
  high: 'bg-red-50 text-fail border border-red-200',
  medium: 'bg-[#FFF5EC] text-[#8C5828] border border-[#FFCB9A]',
  low: 'bg-[#EBF5F2] text-[#116466] border border-[#D1E8E2]',
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
