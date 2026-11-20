import { CheckCircle2, AlertCircle, Clock, HelpCircle } from 'lucide-react'
import type { EvaluationResult } from '../../lib/api'

const RESULT_ICONS: Record<EvaluationResult, typeof CheckCircle2> = {
  PASS: CheckCircle2,
  UPCOMING_DEADLINE: Clock,
  FAIL: AlertCircle,
  INSUFFICIENT_DATA: HelpCircle,
}

const RESULT_CONFIG: Record<
  EvaluationResult,
  { label: string; text: string; bg: string; border: string; desc: string }
> = {
  PASS: {
    label: 'Pass',
    text: 'text-pass',
    bg: 'bg-pass-bg',
    border: 'border-pass-border',
    desc: 'Fully compliant with rule conditions',
  },
  UPCOMING_DEADLINE: {
    label: 'Upcoming Deadline',
    text: 'text-upcoming',
    bg: 'bg-upcoming-bg',
    border: 'border-upcoming-border',
    desc: 'Approaching filing cutoff within alert window',
  },
  FAIL: {
    label: 'Fail',
    text: 'text-fail',
    bg: 'bg-fail-bg',
    border: 'border-fail-border',
    desc: 'Non-compliant with rule conditions',
  },
  INSUFFICIENT_DATA: {
    label: 'Insufficient Data',
    text: 'text-insufficient',
    bg: 'bg-insufficient-bg',
    border: 'border-insufficient-border',
    desc: 'Missing required profile metric or unit mismatch',
  },
}

export function ResultBadge({
  result,
  showLabel = true,
  className = '',
}: {
  result: EvaluationResult
  showLabel?: boolean
  className?: string
}) {
  const cfg = RESULT_CONFIG[result]
  const Icon = RESULT_ICONS[result]

  return (
    <span
      title={`${cfg.label}: ${cfg.desc}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap border ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {showLabel && <span>{cfg.label}</span>}
    </span>
  )
}
