import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  apiGet,
  apiSend,
  openPdf,
  type Modality,
  type ObligationDetail,
  type ObligationListItem,
  type Threshold,
} from '../lib/api'
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
  'mt-1 block w-full rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none disabled:bg-surface'

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

  if (error && !ob) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>
  if (!ob || !form || !original) return <p className="text-sm text-muted">Loading…</p>

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/review" className="text-sm text-muted hover:text-ink">
            ← Review queue
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Obligation <span className="font-mono text-base">{ob.obligationKey}</span>
            <span className="ml-2 text-sm font-normal text-muted">version {ob.version}</span>
          </h1>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize">{ob.status === 'edited' ? 'edited & approved' : ob.status}</span>
      </div>

      {!latest && ob.nextVersion && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-upcoming">
          This is an older version.{' '}
          <Link className="underline" to={`/obligations/${ob.nextVersion.id}`}>
            Open the latest version
          </Link>
        </p>
      )}
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-upcoming">
        Proposed by AI. Confidence is a review aid, not proof of correctness. Check every field against the source text.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: source */}
        <section aria-labelledby="source-heading" className="h-fit rounded-xl border border-line bg-panel p-5 shadow-sm lg:sticky lg:top-4">
          <h2 id="source-heading" className="text-sm font-medium tracking-wide text-muted uppercase">
            Source
          </h2>
          <p className="mt-2 text-sm">
            <Link to={`/documents/${doc.document.id}?version=${doc.versionNo}`} className="font-medium text-brand hover:underline">
              {doc.document.title}
            </Link>
            <span className="text-muted">
              {' '}
              · v{doc.versionNo} · clause <span className="font-mono">{ob.clause.clauseNumber}</span> ·{' '}
            </span>
            <button
              type="button"
              className="text-brand underline"
              onClick={() => openPdf(doc.document.id, doc.versionNo, ob.clause.page).catch((err: Error) => setError(err.message))}
            >
              page {ob.clause.page}
            </button>
          </p>
          <p className="mt-4 text-sm leading-relaxed">
            {highlightQuotes(ob.clause.text, [ob.quote]).map((seg, i) =>
              seg.marked ? (
                <mark key={i} className="rounded-sm bg-yellow-100 px-0.5 text-ink">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
          <p className="mt-3 text-xs text-muted">Highlighted: the exact quote the AI used. The quote cannot be edited.</p>
          {ob.confidence !== null && <p className="mt-2 text-xs text-muted">Model confidence {Math.round(ob.confidence * 100)}%</p>}
        </section>

        {/* Right: fields */}
        <form onSubmit={(e) => submit(approveAction, e)} className="space-y-4 rounded-xl border border-line bg-panel p-5 shadow-sm">
          <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Extracted fields</h2>
          <fieldset disabled={!editable || busy} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <label className="block text-sm font-medium">
                Subject
                <input className={field} value={form.subject} onChange={(e) => set({ subject: e.target.value })} required />
              </label>
              <label className="block text-sm font-medium">
                Modality
                <select className={field} value={form.modality} onChange={(e) => set({ modality: e.target.value as Modality })}>
                  <option value="must">must</option>
                  <option value="must_not">must not</option>
                  <option value="should">should</option>
                  <option value="may">may</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Action
              <textarea className={field} rows={2} value={form.action} onChange={(e) => set({ action: e.target.value })} required />
            </label>
            <label className="block text-sm font-medium">
              Condition
              <textarea className={field} rows={2} value={form.condition} onChange={(e) => set({ condition: e.target.value })} />
            </label>

            <div className="rounded-lg border border-line p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.hasThreshold} onChange={(e) => set({ hasThreshold: e.target.checked })} />
                Numeric threshold
              </label>
              {form.hasThreshold && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_5rem_8rem_6rem]">
                  <label className="block text-xs">
                    Metric (data field)
                    <input
                      className={`${field} font-mono`}
                      value={form.threshold.metric}
                      pattern="[a-z][a-z0-9_]*"
                      title="lowercase snake_case"
                      onChange={(e) => set({ threshold: { ...form.threshold, metric: e.target.value } })}
                    />
                  </label>
                  <label className="block text-xs">
                    Operator
                    <select className={field} value={form.threshold.operator} onChange={(e) => set({ threshold: { ...form.threshold, operator: e.target.value } })}>
                      {OPERATORS.map((op) => (
                        <option key={op}>{op}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    Value
                    <input
                      className={field}
                      type="number"
                      step="any"
                      value={form.threshold.value}
                      onChange={(e) => set({ threshold: { ...form.threshold, value: Number(e.target.value) } })}
                    />
                  </label>
                  <label className="block text-xs">
                    Unit
                    <input className={field} value={form.threshold.unit ?? ''} onChange={(e) => set({ threshold: { ...form.threshold, unit: e.target.value || null } })} />
                  </label>
                  <p className="text-xs text-muted sm:col-span-4">
                    The threshold describes a compliant value, whatever the modality (e.g. “shall not exceed 200” → ≤ 200).
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Deadline (explicit date only)
                <input className={field} type="date" value={form.deadline} onChange={(e) => set({ deadline: e.target.value })} />
              </label>
              <label className="block text-sm font-medium">
                Evidence
                <input className={field} value={form.evidence} onChange={(e) => set({ evidence: e.target.value })} />
              </label>
            </div>

            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.machineCheckable} onChange={(e) => set({ machineCheckable: e.target.checked })} />
                Machine-checkable (becomes a rule when approved)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ambiguityFlag} onChange={(e) => set({ ambiguityFlag: e.target.checked })} />
                Ambiguous
              </label>
              {form.ambiguityFlag && (
                <input className={field} placeholder="Why is it ambiguous?" value={form.ambiguityReason} onChange={(e) => set({ ambiguityReason: e.target.value })} />
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.referenceOnly} onChange={(e) => set({ referenceOnly: e.target.checked })} />
                Reference only (approved for the register, never evaluated)
              </label>
            </div>

            {allCategories.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Applies to</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {allCategories.map((c) => (
                    <label key={c} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.categories.includes(c)}
                        onChange={(e) => set({ categories: e.target.checked ? [...form.categories, c] : form.categories.filter((x) => x !== c) })}
                      />
                      {c}
                    </label>
                  ))}
                </div>
                {form.categories.length === 0 && <p className="text-xs text-muted">None selected: defaults to Fund Management Entity.</p>}
              </div>
            )}

            <label className="block text-sm font-medium">
              Comment {ob.status === 'proposed' ? '(required to reject)' : ''}
              <textarea className={field} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </fieldset>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}

          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || (ob.status !== 'proposed' && !dirty && !categoriesChanged)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50">
                {approveAction === 'approve' ? 'Approve' : ob.status === 'proposed' ? 'Approve with edits' : 'Save as new version'}
              </button>
              <button
                type="button"
                disabled={busy || comment.trim().length < 3}
                onClick={() => submit('reject')}
                className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-fail hover:bg-red-50 disabled:opacity-50"
                title={comment.trim().length < 3 ? 'Write a comment to reject' : undefined}
              >
                Reject
              </button>
              {dirty && (
                <button type="button" onClick={() => setForm(original)} className="px-2 text-sm text-muted underline">
                  Undo changes
                </button>
              )}
            </div>
          )}
          {!canReview && <p className="text-sm text-muted">Read-only: reviewing needs the reviewer role.</p>}
        </form>
      </div>

      <section aria-labelledby="history-heading" className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <h2 id="history-heading" className="font-medium">
          History
        </h2>
        <ol className="mt-3 space-y-3 text-sm">
          {ob.history.map((h) => (
            <li key={h.id}>
              <Link to={`/obligations/${h.id}`} className={h.id === ob.id ? 'font-medium' : 'text-brand hover:underline'}>
                Version {h.version}
              </Link>{' '}
              <span className="text-muted">
                · {h.status} · {new Date(h.createdAt).toLocaleString()}
                {h.approvedBy && ` · approved by ${h.approvedBy.name}`}
              </span>
              {h.reviews.map((r, i) => (
                <p key={i} className="ml-4 text-xs text-muted">
                  {r.reviewer.name} chose <b>{r.action}</b> on {new Date(r.createdAt).toLocaleString()}
                  {r.comment && <> — “{r.comment}”</>}
                </p>
              ))}
            </li>
          ))}
        </ol>
        {ob.rules.length > 0 && (
          <p className="mt-3 text-sm">
            Rules from this version:{' '}
            {ob.rules.map((r) => (
              <Link key={r.id} to={`/rules?key=${encodeURIComponent(r.ruleKey)}`} className="mr-2 font-mono text-xs text-brand hover:underline">
                {r.ruleKey} v{r.ruleVersion}
                {r.isActive ? '' : ' (inactive)'}
              </Link>
            ))}
          </p>
        )}
      </section>
    </div>
  )
}
