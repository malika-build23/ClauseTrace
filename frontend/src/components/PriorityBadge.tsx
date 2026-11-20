const STYLE = {
  high: 'bg-red-50 text-fail border border-red-200 dark:bg-red-950/40 dark:border-red-900',
  medium: 'bg-[#F9EEF4] text-[#6B3254] border border-[#E0BACF] dark:bg-[#2B1B25] dark:text-[#E0BACF] dark:border-[#523347]',
  low: 'bg-[#EEF3FD] text-[#4D608E] border border-[#9FB0E8] dark:bg-[#15223C] dark:text-[#9FB0E8] dark:border-[#253961]',
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
