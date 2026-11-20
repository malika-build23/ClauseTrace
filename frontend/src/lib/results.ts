import type { EvaluationResult } from './api'

/** Order used everywhere results are listed or stacked. */
export const RESULT_ORDER: EvaluationResult[] = ['PASS', 'UPCOMING_DEADLINE', 'FAIL', 'INSUFFICIENT_DATA']

export const RESULT_META: Record<
  EvaluationResult,
  { label: string; icon: string; text: string; bg: string; fill: string }
> = {
  PASS: {
    label: 'Pass',
    icon: '✓',
    text: 'text-pass',
    bg: 'bg-pass-bg border border-pass-border',
    fill: 'bg-pass',
  },
  UPCOMING_DEADLINE: {
    label: 'Upcoming',
    icon: '◷',
    text: 'text-upcoming',
    bg: 'bg-upcoming-bg border border-upcoming-border',
    fill: 'bg-upcoming',
  },
  FAIL: {
    label: 'Fail',
    icon: '✕',
    text: 'text-fail',
    bg: 'bg-fail-bg border border-fail-border',
    fill: 'bg-fail',
  },
  INSUFFICIENT_DATA: {
    label: 'Insufficient data',
    icon: '?',
    text: 'text-insufficient',
    bg: 'bg-insufficient-bg border border-insufficient-border',
    fill: 'bg-insufficient',
  },
}
