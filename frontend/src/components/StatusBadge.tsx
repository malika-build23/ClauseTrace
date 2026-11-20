import type { ParsingStatus } from '../lib/api'

const STYLES: Record<ParsingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-insufficient' },
  parsing: { label: 'Parsing…', className: 'bg-blue-50 text-brand' },
  parsed: { label: 'Parsed', className: 'bg-green-50 text-pass' },
  needs_manual_split: { label: 'Needs manual split', className: 'bg-amber-50 text-upcoming' },
  failed: { label: 'Parse failed', className: 'bg-red-50 text-fail' },
}

export function StatusBadge({ status }: { status: ParsingStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  )
}
