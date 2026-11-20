import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { SplitSquareVertical, FileText } from 'lucide-react'
import {
  apiGet,
  apiSend,
  type Modality,
  type ObligationDetail,
  type ObligationListItem,
  type Threshold,
} from '../lib/api'
import { ConnectionsGraph } from '../components/ConnectionsGraph'
import { PdfViewer } from '../components/pdf/PdfViewer'
import { StatusBadge } from '../components/StatusBadge'
import { ModalityBadge } from '../components/ui/ModalityBadge'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { useAuth } from '../lib/auth'
import { highlightQuotes } from '../lib/highlight'

type Form = {
  subject: string
  modality: Modality
  action: string
  condition: string
  hasThreshold: boolean
  threshold: Threshold
  deadline: string
  evidence: string
  machineCheckable: boolean
  ambiguityFlag: boolean
  ambiguityReason: string
  referenceOnly: boolean
  categories: string[]
}

const OPERATORS = ['>=', '>', '<=', '<', '==', '!=']
const field =
  'mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none disabled:opacity-60'

function toForm(o: ObligationDetail): Form {
  return {
    subject: o.subject,
    modality: o.modality,
    action: o.action,
    condition: o.condition ?? '',
    hasThreshold: o.thresholdJson !== null,
    threshold: o.thresholdJson ?? { metric: '', operator: '>=', value: 0, unit: null },
    deadline: o.deadline ? o.deadline.slice(0, 10) : '',
    evidence: o.evidence ?? '',
    machineCheckable: o.machineCheckable,
    ambiguityFlag: o.ambiguityFlag,
    ambiguityReason: o.ambiguityReason ?? '',
    referenceOnly: o.referenceOnly,
    categories: o.entityCategories.map((c) => c.entityCategory.name).sort(),
  }
}

/** Only the fields that differ from the stored obligation. */
function diff(original: Form, current: Form) {
  const edits: Record<string, unknown> = {}
  const nullable = (s: string) => (s.trim() ? s.trim() : null)
  if (current.subject.trim() !== original.subject) edits.subject = current.subject.trim()
  if (current.modality !== original.modality) edits.modality = current.modality
  if (current.action.trim() !== original.action) edits.action = current.action.trim()
  if (nullable(current.condition) !== nullable(original.condition)) edits.condition = nullable(current.condition)
  const t = current.hasThreshold ? { ...current.threshold, unit: current.threshold.unit?.trim() || null } : null
  const o = original.hasThreshold ? original.threshold : null
  if (JSON.stringify(t) !== JSON.stringify(o)) edits.threshold = t
  if (nullable(current.deadline) !== nullable(original.deadline)) edits.deadline = nullable(current.deadline)
  if (nullable(current.evidence) !== nullable(original.evidence)) edits.evidence = nullable(current.evidence)
  if (current.machineCheckable !== original.machineCheckable) edits.machineCheckable = current.machineCheckable
  if (current.ambiguityFlag !== original.ambiguityFlag) edits.ambiguityFlag = current.ambiguityFlag
  if (nullable(current.ambiguityReason) !== nullable(original.ambiguityReason)) edits.ambiguityReason = nullable(current.ambiguityReason)
  return edits
}

export function ObligationReviewPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canReview = can('reviewer')

  const [ob, setOb] = useState<ObligationDetail | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showLivePdf, setShowLivePdf] = useState(true)

  const load = useCallback(() => {
    setError(null)
    apiGet<ObligationDetail>(`/api/obligations/${id}`)
      .then((o) => {
        setOb(o)
        setForm(toForm(o))
        setComment('')
      })
      .catch((err: Error) => setError(err.message))
  }, [id])
  useEffect(load, [load])

  useEffect(() => {
    apiGet<{ name: string }[]>('/api/entity-profiles/categories')
      .then((c) => setAllCategories(c.map((x) => x.name)))
      .catch(() => setAllCategories([]))
  }, [])

  const original = useMemo(() => (ob ? toForm(ob) : null), [ob])
  const edits = useMemo(() => (original && form ? diff(original, form) : {}), [original, form])
  const dirty = Object.keys(edits).length > 0 || (original && form && JSON.stringify(original.referenceOnly) !== JSON.stringify(form.referenceOnly))
  const categoriesChanged = original && form && JSON.stringify(original.categories) !== JSON.stringify([...form.categories].sort())

  if (error && !ob) return <ErrorState title="Could not load obligation" message={error} onRetry={load} />
  if (!ob || !form || !original) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  const latest = !ob.nextVersion
  const editable = canReview && latest && ob.status !== 'rejected'
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })
  const doc = ob.clause.documentVersion

  async function goNext() {
    const next = await apiGet<ObligationListItem[]>('/api/obligations?status=proposed&limit=2').catch(() => [])
    const target = next.find((n) => n.id !== id)
    navigate(target ? `/obligations/${target.id}` : '/review')
  }

  async function submit(action: 'approve' | 'edit' | 'reject', e?: FormEvent) {
    e?.preventDefault()
    if (!form) return
    setBusy(true)
    setError(null)
    try {
      const body =
        action === 'reject'
          ? { action, comment }
          : {
              action,
              ...(action === 'edit' ? { edits } : {}),
              comment: comment.trim() || undefined,
              referenceOnly: form.referenceOnly,
              categories: form.categories.length ? form.categories : undefined,
            }
      const res = await apiSend<{ id: string }>('PATCH', `/api/obligations/${id}/review`, body)
      if (ob?.status === 'proposed') await goNext()
      else navigate(`/obligations/${res.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const approveAction = dirty || categoriesChanged || ob.status !== 'proposed' ? 'edit' : 'approve'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/review" className="text-xs font-medium text-muted hover:text-ink transition-colors">
            ← Review Queue
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">
              Obligation <span className="font-mono text-xl">{ob.obligationKey}</span>
            </h1>
            <span className="rounded-md bg-surface border border-line px-2 py-0.5 text-xs font-semibold text-muted">
              v{ob.version}
            </span>
            <StatusBadge status={ob.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLivePdf(!showLivePdf)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand transition-colors"
          >
            {showLivePdf ? <FileText className="h-3.5 w-3.5" /> : <SplitSquareVertical className="h-3.5 w-3.5" />}
            <span>{showLivePdf ? 'Snippet Mode' : 'Live PDF Source'}</span>
          </button>
        </div>
      </div>

      {!latest && ob.nextVersion && (
        <div className="rounded-xl border border-upcoming-border bg-upcoming-bg px-4 py-2.5 text-xs text-upcoming">
          This is an older version.{' '}
          <Link className="font-semibold underline hover:text-ink" to={`/obligations/${ob.nextVersion.id}`}>
            Open the latest version (v{ob.version + 1})
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-upcoming-border bg-upcoming-bg px-4 py-2.5 text-xs text-upcoming flex items-center justify-between">
        <span>
          <b>Proposed by AI with code guardrails.</b> Confidence is a review aid, not proof of correctness. Check every field against the source text.
        </span>
        <span className="font-semibold text-ink">Exact Quote Verified</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side: Live PDF Viewer or Source Snippet */}
        {showLivePdf ? (
          <div className="space-y-4">
            <PdfViewer
              documentId={doc.document.id}
              versionNo={doc.versionNo}
              initialPage={ob.clause.page}
              obligations={[ob as unknown as ObligationDetail]}
              activeObligationId={ob.id}
            />
          </div>
        ) : (
          <section aria-labelledby="source-heading" className="h-fit rounded-2xl border border-line bg-panel p-6 shadow-sm space-y-4 lg:sticky lg:top-20">
            <h2 id="source-heading" className="text-xs font-bold tracking-wider text-muted uppercase">
              Source Clause & Document
            </h2>
            <p className="text-sm">
              <Link to={`/documents/${doc.document.id}?version=${doc.versionNo}`} className="font-semibold text-brand hover:underline">
                {doc.document.title}
              </Link>
              <span className="text-muted">
                {' '}· v{doc.versionNo} · clause <span className="font-mono font-semibold text-ink">{ob.clause.clauseNumber}</span> ·{' '}
              </span>
              <span className="font-medium text-brand">page {ob.clause.page}</span>
            </p>
            <blockquote className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink font-serif">
              {highlightQuotes(ob.clause.text, [ob.quote]).map((seg, i) =>
                seg.marked ? (
                  <mark key={i} className="rounded-xs bg-amber-200 dark:bg-amber-900/60 px-1 font-sans font-bold text-ink">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </blockquote>
            <p className="text-xs text-muted">
              Highlighted: the exact quote extracted from the source document. The quote cannot be edited.
            </p>
            {ob.confidence !== null && (
              <p className="text-xs text-muted font-medium">Model confidence: {Math.round(ob.confidence * 100)}%</p>
            )}
          </section>
        )}

        {/* Right Side: Verification Form */}
        <form onSubmit={(e) => submit(approveAction, e)} className="space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-bold tracking-wider text-muted uppercase">Extracted Obligation Fields</h2>
            <ModalityBadge modality={form.modality} />
          </div>

          <fieldset disabled={!editable || busy} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <label className="block text-xs font-semibold text-ink">
                Subject
                <input className={field} value={form.subject} onChange={(e) => set({ subject: e.target.value })} required />
              </label>
              <label className="block text-xs font-semibold text-ink">
                Modality
                <select className={field} value={form.modality} onChange={(e) => set({ modality: e.target.value as Modality })}>
                  <option value="must">MUST</option>
                  <option value="must_not">MUST NOT</option>
                  <option value="should">SHOULD</option>
                  <option value="may">MAY</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-ink">
              Action
              <textarea className={field} rows={2} value={form.action} onChange={(e) => set({ action: e.target.value })} required />
            </label>

            <label className="block text-xs font-semibold text-ink">
              Condition
              <textarea className={field} rows={2} value={form.condition} onChange={(e) => set({ condition: e.target.value })} />
            </label>

            <div className="rounded-xl border border-line bg-surface/50 p-4 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-line text-brand focus:ring-brand"
                  checked={form.hasThreshold}
                  onChange={(e) => set({ hasThreshold: e.target.checked })}
                />
                <span>Numeric threshold constraint</span>
              </label>
              {form.hasThreshold && (
                <div className="grid gap-3 sm:grid-cols-[1fr_5rem_7rem_6rem]">
                  <label className="block text-xs font-semibold text-muted">
                    Metric
                    <input
                      className={`${field} font-mono`}
                      value={form.threshold.metric}
                      pattern="[a-z][a-z0-9_]*"
                      title="lowercase snake_case"
                      onChange={(e) => set({ threshold: { ...form.threshold, metric: e.target.value } })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted">
                    Operator
                    <select className={field} value={form.threshold.operator} onChange={(e) => set({ threshold: { ...form.threshold, operator: e.target.value } })}>
                      {OPERATORS.map((op) => (
                        <option key={op}>{op}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted">
                    Value
                    <input
                      className={field}
                      type="number"
                      step="any"
                      value={form.threshold.value}
                      onChange={(e) => set({ threshold: { ...form.threshold, value: Number(e.target.value) } })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted">
                    Unit
                    <input className={field} value={form.threshold.unit ?? ''} onChange={(e) => set({ threshold: { ...form.threshold, unit: e.target.value || null } })} />
                  </label>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-ink">
                Deadline (explicit cutoff)
                <input className={field} type="date" value={form.deadline} onChange={(e) => set({ deadline: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-ink">
                Required Evidence
                <input className={field} value={form.evidence} onChange={(e) => set({ evidence: e.target.value })} />
              </label>
            </div>

            <div className="space-y-2 text-xs font-medium text-ink">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-line text-brand focus:ring-brand"
                  checked={form.machineCheckable}
                  onChange={(e) => set({ machineCheckable: e.target.checked })}
                />
                <span>Machine-checkable (compiles into an automated rule upon approval)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-line text-upcoming focus:ring-upcoming"
                  checked={form.ambiguityFlag}
                  onChange={(e) => set({ ambiguityFlag: e.target.checked })}
                />
                <span>Flag as ambiguous / subjective</span>
              </label>
              {form.ambiguityFlag && (
                <input className={field} placeholder="Why is it ambiguous?" value={form.ambiguityReason} onChange={(e) => set({ ambiguityReason: e.target.value })} />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-line text-muted focus:ring-muted"
                  checked={form.referenceOnly}
                  onChange={(e) => set({ referenceOnly: e.target.checked })}
                />
                <span>Reference only (approved for regulatory register, not evaluated)</span>
              </label>
            </div>

            {allCategories.length > 0 && (
              <div className="text-xs space-y-1.5">
                <p className="font-semibold text-ink">Applies to Entity Categories:</p>
                <div className="flex flex-wrap gap-3">
                  {allCategories.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-muted hover:text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-line text-brand focus:ring-brand"
                        checked={form.categories.includes(c)}
                        onChange={(e) =>
                          set({
                            categories: e.target.checked
                              ? [...form.categories, c]
                              : form.categories.filter((x) => x !== c),
                          })
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <label className="block text-xs font-semibold text-ink">
              Reviewer Notes / Feedback {ob.status === 'proposed' ? '(required to reject)' : ''}
              <textarea className={field} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </fieldset>

          {error && <ErrorState message={error} />}

          {editable && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
              <button
                type="submit"
                disabled={busy || (ob.status !== 'proposed' && !dirty && !categoriesChanged)}
                className="rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-hover shadow-xs transition-colors disabled:opacity-50"
              >
                {approveAction === 'approve' ? 'Approve Obligation' : ob.status === 'proposed' ? 'Approve with Edits (v2)' : 'Save as New Version'}
              </button>
              {ob.status === 'proposed' && (
                <button
                  type="button"
                  disabled={busy || !comment.trim()}
                  onClick={() => submit('reject')}
                  className="rounded-lg border border-fail-border bg-fail-bg px-4 py-2 text-xs font-semibold text-fail hover:bg-fail-bg/80 transition-colors disabled:opacity-50"
                >
                  Reject Proposal
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                className="ml-auto text-xs font-semibold text-muted hover:text-ink"
              >
                Skip to next
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="pt-4 border-t border-line space-y-4">
        <h3 className="text-base font-semibold text-ink font-display">Regulatory Lineage & Graph Neighbourhood</h3>
        <ConnectionsGraph obligationId={ob.id} highlight={ob.id} />
      </div>
    </div>
  )
}
