import { describe, expect, it } from 'vitest'
import { wordDiff } from '../lib/diff'
import { isRenumberedOnly } from '../lib/changeDetection'
import type { ChangeEvent } from '../lib/api'

describe('wordDiff computation', () => {
  it('correctly identifies identical text as equal', () => {
    const diff = wordDiff('A registered fund manager must maintain net worth.', 'A registered fund manager must maintain net worth.')
    expect(diff.every((d) => d.op === 'equal')).toBe(true)
    expect(diff.map((d) => d.text).join(' ')).toContain('net worth')
  })

  it('detects word deletions and additions', () => {
    const oldText = 'FME must submit quarterly reports within 15 days.'
    const newText = 'FME must submit quarterly reports within 30 days.'
    const diff = wordDiff(oldText, newText)

    const deleted = diff.filter((d) => d.op === 'delete').map((d) => d.text)
    const inserted = diff.filter((d) => d.op === 'insert').map((d) => d.text)

    expect(deleted).toContain('15')
    expect(inserted).toContain('30')
  })

  it('normalizes smart quotes and hyphens across versions', () => {
    const oldText = 'The “authorized” person’s early-stage fund'
    const newText = 'The "authorized" person\'s earlystage fund'
    const diff = wordDiff(oldText, newText)

    // With wordDiff normalization, semantic words match
    expect(diff.some((d) => d.op === 'equal' && d.text.includes('authorized'))).toBe(true)
  })
})

describe('isRenumberedOnly clause detection', () => {
  it('identifies renumbered clauses with unchanged text from summary', () => {
    const change: ChangeEvent = {
      id: 'c1',
      changeType: 'modified',
      clauseRef: '4',
      oldText: 'Every FME shall maintain base capital of USD 100,000.',
      newText: 'Every FME shall maintain base capital of USD 100,000.',
      summary: 'Clause 3 renumbered to 4, text unchanged',
      status: 'pending',
      impactItems: [],
    }
    expect(isRenumberedOnly(change)).toBe(true)
  })

  it('identifies renumbered clauses when oldText and newText are identical', () => {
    const change: ChangeEvent = {
      id: 'c2',
      changeType: 'modified',
      clauseRef: '5',
      oldText: 'The custodian shall hold assets in segregated accounts.  ',
      newText: 'The custodian shall hold assets in segregated accounts.',
      summary: 'Clause 5 moved',
      status: 'pending',
      impactItems: [],
    }
    expect(isRenumberedOnly(change)).toBe(true)
  })

  it('returns false for substantively modified clauses', () => {
    const change: ChangeEvent = {
      id: 'c3',
      changeType: 'modified',
      clauseRef: '6',
      oldText: 'Net worth shall not be less than USD 500,000.',
      newText: 'Net worth shall not be less than USD 1,000,000.',
      summary: 'Clause 6 modified: threshold increased',
      status: 'pending',
      impactItems: [],
    }
    expect(isRenumberedOnly(change)).toBe(false)
  })
})
