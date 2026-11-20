import type { ChangeEvent } from './api'

/**
 * Determines whether a clause change event represents only a renumbering / movement
 * without substantive modifications to the regulatory text.
 */
export function isRenumberedOnly(change: ChangeEvent): boolean {
  if (change.summary) {
    const s = change.summary.toLowerCase()
    if (s.includes('renumbered') && (s.includes('unchanged') || s.includes('text unchanged'))) {
      return true
    }
  }
  if (change.oldText && change.newText) {
    const norm = (str: string) => str.replace(/\s+/g, ' ').trim().toLowerCase()
    if (norm(change.oldText) === norm(change.newText)) {
      return true
    }
  }
  return false
}
