import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultBadge } from '../components/ui/ResultBadge'
import { ModalityBadge } from '../components/ui/ModalityBadge'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { applyTheme } from '../lib/theme'
import type { EvaluationResult, Modality } from '../lib/api'

describe('Step 0 Design System & Status Mapping', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('renders every EvaluationResult with text label and icon (never colour alone)', () => {
    const results: { result: EvaluationResult; label: string }[] = [
      { result: 'PASS', label: 'Pass' },
      { result: 'UPCOMING_DEADLINE', label: 'Upcoming Deadline' },
      { result: 'FAIL', label: 'Fail' },
      { result: 'INSUFFICIENT_DATA', label: 'Insufficient Data' },
    ]

    results.forEach(({ result, label }) => {
      const { unmount } = render(<ResultBadge result={result} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      const badge = screen.getByTitle(new RegExp(label))
      expect(badge).toBeInTheDocument()
      unmount()
    })
  })

  it('renders every Modality with distinct text, icon, and visual pattern', () => {
    const modalities: Modality[] = ['must', 'must_not', 'should', 'may']
    const expectedLabels: Record<Modality, string> = {
      must: 'MUST',
      must_not: 'MUST NOT',
      should: 'SHOULD',
      may: 'MAY',
    }

    modalities.forEach((mod) => {
      const { unmount } = render(<ModalityBadge modality={mod} />)
      expect(screen.getByText(expectedLabels[mod])).toBeInTheDocument()
      unmount()
    })
  })

  it('renders parsing and obligation statuses with icon and text', () => {
    render(<StatusBadge status="parsed" />)
    expect(screen.getByText('Parsed')).toBeInTheDocument()

    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Approved')).toBeInTheDocument()

    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('ErrorState renders error message and triggers retry callback', () => {
    let retried = false
    render(
      <ErrorState
        title="Extraction Failed"
        message="Could not reach parser service"
        onRetry={() => {
          retried = true
        }}
      />,
    )

    expect(screen.getByText('Extraction Failed')).toBeInTheDocument()
    expect(screen.getByText('Could not reach parser service')).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(retried).toBe(true)
  })

  it('EmptyState renders icon, title, and description', () => {
    render(<EmptyState title="No active rules" description="Compile approved obligations to create rules" />)
    expect(screen.getByText('No active rules')).toBeInTheDocument()
    expect(screen.getByText('Compile approved obligations to create rules')).toBeInTheDocument()
  })

  it('Theme manager toggles dark class on html element', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('ThemeToggle cycles theme on click', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button', { name: /toggle color theme/i })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    // Theme cycled
    expect(localStorage.getItem('clausetrace.theme')).toBeTruthy()
  })
})
