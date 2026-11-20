import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Sparkles, FileText, CheckSquare, Calculator, History, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { TOUR_EVENT } from '../../lib/tour'

const TOUR_STORAGE_KEY = 'clausetrace.tour_dismissed'

interface TourStep {
  title: string
  subtitle: string
  description: string
  icon: typeof Sparkles
  href?: string
  linkText?: string
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to ClauseTrace',
    subtitle: 'Enterprise RegTech for GIFT City IFSCA Regulations',
    description:
      'ClauseTrace bridges the gap between dense financial circulars and automated, auditable compliance checks. Explore how AI reads, humans verify, and deterministic rules evaluate.',
    icon: Sparkles,
  },
  {
    title: '1. Regulatory Documents & Clauses',
    subtitle: 'Hierarchical PDF Ingestion',
    description:
      'Explore official IFSCA circulars with clause-level nesting and exact page coordinates. Click page numbers to view documents in the synchronized PDF viewer.',
    icon: FileText,
    href: '/documents',
    linkText: 'Explore Documents',
  },
  {
    title: '2. Human-in-the-Loop Review Queue',
    subtitle: 'Triage AI Proposals with Verbatim Quotes',
    description:
      'Compliance officers review AI proposals. Approve, edit (creating immutable version v2), or reject with feedback. The system guarantees exact quotes match the source document.',
    icon: CheckSquare,
    href: '/review',
    linkText: 'Go to Review Queue',
  },
  {
    title: '3. Deterministic Rule Compiler',
    subtitle: 'Zero AI in Compliance Evaluations',
    description:
      'Approved obligations compile into mathematical rules (thresholds, deadlines, required fields). Evaluations produce 100% repeatable PASS, FAIL, UPCOMING, or INSUFFICIENT DATA outcomes.',
    icon: Calculator,
    href: '/rules',
    linkText: 'View Compiled Rules',
  },
  {
    title: '4. Traceability & Amendment Impact',
    subtitle: 'Complete Audit Lineage & Blast Radius',
    description:
      'Every compliance outcome links backward to the exact rule version, reviewer, verbatim quote, and PDF page. When circulars change, amendment diffing highlights impacted downstream rules.',
    icon: History,
    href: '/audit',
    linkText: 'Inspect Audit Trail',
  },
]

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(TOUR_STORAGE_KEY)
      if (!dismissed) {
        // Small delay so the page loads cleanly first
        const timer = setTimeout(() => setIsOpen(true), 1200)
        return () => clearTimeout(timer)
      }
    } catch {
      // storage unavailable
    }
  }, [])

  useEffect(() => {
    const handleReopen = () => {
      setStep(0)
      setIsOpen(true)
    }
    window.addEventListener(TOUR_EVENT, handleReopen)
    return () => window.removeEventListener(TOUR_EVENT, handleReopen)
  }, [])

  const dismiss = (permanent = true) => {
    setIsOpen(false)
    if (permanent) {
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, 'true')
      } catch {
        // ignore
      }
    }
  }

  if (!isOpen) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome Tour"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-light p-2.5 text-brand">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-brand uppercase">
                Step {step + 1} of {STEPS.length}
              </span>
              <h3 className="text-lg font-bold text-ink font-display">{current.title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">{current.subtitle}</h4>
          <p className="text-sm text-muted leading-relaxed">{current.description}</p>
          {current.href && (
            <div className="pt-2">
              <Link
                to={current.href}
                onClick={() => dismiss(false)}
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                {current.linkText} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 pt-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-brand' : 'w-2 bg-line hover:bg-muted'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between border-t border-line pt-4 text-xs">
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="text-muted hover:text-ink font-medium"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-ink hover:border-brand"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-1.5 font-semibold text-white hover:bg-brand-hover shadow-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dismiss(true)}
                className="rounded-lg bg-brand px-4 py-1.5 font-semibold text-white hover:bg-brand-hover shadow-xs"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
