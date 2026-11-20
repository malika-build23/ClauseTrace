import { CheckCircle2, Clock, AlertTriangle, XCircle, FileQuestion, RefreshCw } from 'lucide-react'
import type { ParsingStatus, ObligationStatus } from '../../lib/api'

type AnyStatus = ParsingStatus | ObligationStatus | 'pending' | 'active' | 'inactive'

interface StatusConfig {
  label: string
  icon: typeof CheckCircle2
  className: string
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Parsing status
  parsed: { label: 'Parsed', icon: CheckCircle2, className: 'bg-pass-bg text-pass border border-pass-border' },
  parsing: { label: 'Parsing…', icon: RefreshCw, className: 'bg-brand-light text-brand border border-brand animate-pulse' },
  pending: { label: 'Pending', icon: Clock, className: 'bg-surface text-muted border border-line' },
  needs_manual_split: { label: 'Needs split', icon: AlertTriangle, className: 'bg-upcoming-bg text-upcoming border border-upcoming-border' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-fail-bg text-fail border border-fail-border' },

  // Obligation status
  proposed: { label: 'Proposed', icon: Clock, className: 'bg-surface text-muted border border-line border-dashed' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-pass-bg text-pass border border-pass-border' },
  edited: { label: 'Approved (Edited)', icon: CheckCircle2, className: 'bg-brand-light text-brand border border-brand' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-fail-bg text-fail border border-fail-border' },

  // General status
  active: { label: 'Active', icon: CheckCircle2, className: 'bg-pass-bg text-pass border border-pass-border' },
  inactive: { label: 'Inactive', icon: XCircle, className: 'bg-surface text-muted border border-line' },
}

export function StatusBadge({ status, className = '' }: { status: AnyStatus; className?: string }) {
  const config = STATUS_MAP[status] ?? {
    label: String(status),
    icon: FileQuestion,
    className: 'bg-surface text-muted border border-line',
  }

  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${config.className} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'parsing' ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  )
}
