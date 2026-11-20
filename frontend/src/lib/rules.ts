import type { RuleDefinitionJson } from './api'

const OP: Record<string, string> = { '>=': '≥', '<=': '≤', '==': '=', '!=': '≠', '>': '>', '<': '<' }

/** One-line, human-readable description of a rule. */
export function ruleSummary(d: RuleDefinitionJson): string {
  if (d.type === 'threshold') return `${d.input_field} ${OP[d.operator ?? ''] ?? d.operator} ${d.value?.toLocaleString()}${d.unit ? ` ${d.unit}` : ''}`
  if (d.type === 'deadline') return `${d.input_field} on or before ${d.due_date} (upcoming within ${d.upcoming_window_days} days)`
  return `${d.input_field} must be present`
}

/** Data fields a rule reads (a threshold with a unit also reads <field>_unit). */
export function ruleFields(d: RuleDefinitionJson): string[] {
  return d.type === 'threshold' && d.unit ? [d.input_field, `${d.input_field}_unit`] : [d.input_field]
}
