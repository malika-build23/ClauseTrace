import type { ParsingStatus } from '../lib/api'

const STYLES: Record<ParsingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-insufficient border border-slate-200' },
  parsing: { label: 'Parsing…', className: 'bg-[#EBF5F2] text-[#116466] border border-[#D1E8E2] animate-pulse' },
  parsed: { label: 'Parsed', className: 'bg-[#EBF5F2] text-[#116466] border border-[#D1E8E2]' },
  needs_manual_split: { label: 'Needs manual split', className: 'bg-[#FFF5EC] text-[#8C5828] border border-[#FFCB9A]' },
  failed: { label: 'Parse failed', className: 'bg-red-50 text-fail border border-red-200' },
}

export function StatusBadge({ status }: { status: ParsingStatus }) {
  const s = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  )
}
