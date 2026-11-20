import type { EvaluationResult } from './api'

/** Order used everywhere results are listed or stacked. */
export const RESULT_ORDER: EvaluationResult[] = ['PASS', 'UPCOMING_DEADLINE', 'FAIL', 'INSUFFICIENT_DATA']

export const RESULT_META: Record<EvaluationResult, { label: string; icon: string; text: string; bg: string; fill: string }> = {
  PASS: { label: 'Pass', icon: '✓', text: 'text-[#116466]', bg: 'bg-[#EBF5F2] border border-[#D1E8E2]', fill: 'bg-chart-pass' },
  UPCOMING_DEADLINE: { label: 'Upcoming', icon: '◷', text: 'text-[#8C5828]', bg: 'bg-[#FFF5EC] border border-[#FFCB9A]', fill: 'bg-chart-upcoming' },
  FAIL: { label: 'Fail', icon: '✕', text: 'text-fail', bg: 'bg-red-50 border border-red-200', fill: 'bg-chart-fail' },
  INSUFFICIENT_DATA: { label: 'Insufficient data', icon: '?', text: 'text-insufficient', bg: 'bg-slate-100 border border-slate-200', fill: 'bg-chart-unknown' },
}
