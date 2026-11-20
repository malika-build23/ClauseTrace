import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { apiGet, apiPost, apiSend, type ChangeEvent, type ChangesResponse, type DocumentDetail, type ImpactItem } from '../lib/api'
import { useAuth } from '../lib/auth'
import { wordDiff } from '../lib/diff'
import { RESULT_META, RESULT_ORDER } from '../lib/results'

const TYPE_STYLE: Record<ChangeEvent['changeType'], string> = {
  added: 'bg-green-50 text-pass',
  removed: 'bg-red-50 text-fail',
  modified: 'bg-amber-50 text-upcoming',
}

function Diff({ change }: { change: ChangeEvent }) {
  if (change.changeType === 'added') return <p className="rounded bg-green-50 p-3 text-sm leading-relaxed">{change.newText}</p>
  if (change.changeType === 'removed') return <p className="rounded bg-red-50 p-3 text-sm leading-relaxed line-through decoration-red-400">{change.oldText}</p>
  return (
    <p className="rounded bg-surface p-3 text-sm leading-relaxed">
      {wordDiff(change.oldText ?? '', change.newText ?? '').map((s, i) =>
        s.op === 'equal' ? (
          <span key={i}>{s.text} </span>
        ) : s.op === 'delete' ? (
          <del key={i} className="bg-red-100 text-fail decoration-red-500" title="Removed">
            {s.text}{' '}
          </del>
        ) : (
          <ins key={i} className="bg-green-100 text-pass no-underline" title="Added">
            {s.text}{' '}
          </ins>
        ),
      )}
    </p>
  )
}

function Impact({ item, canEdit, onChange }: { item: ImpactItem; canEdit: boolean; onChange: (status: ImpactItem['reviewStatus']) => void }) {
  const results = RESULT_ORDER.filter((r) => item.evaluations[r])
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      {item.obligation && (
        <Link to={`/obligations/${item.obligation.id}`} className="font-mono text-xs text-brand hover:underline">
          {item.obligation.obligationKey} v{item.obligation.version}
        </Link>
      )}
      <span className="text-xs text-muted">({item.obligation?.status})</span>
      {item.rule && (
        <Link to={`/rules?key=${encodeURIComponent(item.rule.ruleKey)}`} className="font-mono text-xs text-brand hover:underline">
          → {item.rule.ruleKey} v{item.rule.ruleVersion}
        </Link>
      )}
      {results.length > 0 && (
        <span className="text-xs text-muted">
          past results:{' '}
          {results.map((r) => (
            <span key={r} className="mr-1">
              {RESULT_META[r].icon} {item.evaluations[r]}
            </span>
          ))}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-1.5 py-0.5">{item.reviewStatus.replace('_', ' ')}</span>
        {canEdit && item.reviewStatus === 'pending' && (
          <>
            <button type="button" className="text-brand underline" onClick={() => onChange('confirmed')}>
              Confirm impact
            </button>
            <button type="button" className="text-muted underline" onClick={() => onChange('dismissed')}>
              Dismiss
            </button>
          </>
        )}
      </span>
    </li>
  )
}

export function ComparePage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { can } = useAuth()
  const canEdit = can('reviewer')
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [data, setData] = useState<ChangesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = params.get('from')
  const to = params.get('to')
  const query = `${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`

  const load = useCallback(() => {
    apiGet<DocumentDetail>(`/api/documents/${id}`)
      .then(setDoc)
      .catch((err: Error) => setError(err.message))
    apiGet<ChangesResponse>(`/api/documents/${id}/changes?${query}`)
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [id, query])
  useEffect(load, [load])

  async function compare() {
    setBusy(true)
    setError(null)
    try {
      await apiPost(`/api/documents/${id}/compare`, {
        ...(from ? { fromVersion: Number(from) } : {}),
        ...(to ? { toVersion: Number(to) } : {}),
      })
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function setChange(change: ChangeEvent, status: ChangeEvent['status']) {
    await apiSend('PATCH', `/api/changes/${change.id}`, { status }).catch((err: Error) => setError(err.message))
    load()
  }
  async function setImpact(item: ImpactItem, reviewStatus: ImpactItem['reviewStatus']) {
    await apiSend('PATCH', `/api/impact-items/${item.id}`, { reviewStatus }).catch((err: Error) => setError(err.message))
    load()
  }

  if (error && !data) return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>
  if (!data || !doc) return <p className="text-sm text-muted">Loading…</p>

  const count = (t: ChangeEvent['changeType']) => data.changes.filter((c) => c.changeType === t).length
  const pending = data.changes.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/documents/${id}`} className="text-sm text-muted hover:text-ink">
          ← {doc.title}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          What changed: version {data.fromNo ?? '?'} → {data.toNo ?? '?'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Clauses are matched by identical text first, then by number, then by similarity, so renumbering alone is not a change.
          Approved obligations and rules are never changed automatically.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}

      {data.fromNo === null ? (
        <p className="text-sm text-muted">This document has only one version. Upload an amended version to compare.</p>
      ) : !data.compared && data.changes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm">
          <p className="text-muted">These versions have not been compared yet.</p>
          {canEdit && (
            <button type="button" onClick={compare} disabled={busy} className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? 'Comparing…' : 'Compare now'}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="flex flex-wrap gap-2 text-sm">
            <span className={`rounded px-2 py-0.5 ${TYPE_STYLE.modified}`}>{count('modified')} modified</span>
            <span className={`rounded px-2 py-0.5 ${TYPE_STYLE.added}`}>{count('added')} added</span>
            <span className={`rounded px-2 py-0.5 ${TYPE_STYLE.removed}`}>{count('removed')} removed</span>
            <span className="text-muted">· {pending} awaiting review</span>
          </p>
          {data.changes.length === 0 && <p className="text-sm text-muted">No changes in clause text between these versions.</p>}
          <ol className="space-y-4">
            {data.changes.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-panel p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${TYPE_STYLE[c.changeType]}`}>{c.changeType}</span>
                  <span className="text-sm font-medium">{c.summary}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.status}</span>
                    {canEdit && c.status === 'pending' && (
                      <>
                        <button type="button" className="text-brand underline" onClick={() => setChange(c, 'confirmed')}>
                          Confirm
                        </button>
                        <button type="button" className="text-muted underline" onClick={() => setChange(c, 'dismissed')}>
                          Dismiss
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-3">
                  <Diff change={c} />
                </div>
                {c.impactItems.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium tracking-wide text-muted uppercase">Affected obligations and rules</p>
                    <ul className="divide-y divide-line">
                      {c.impactItems.map((item) => (
                        <Impact key={item.id} item={item} canEdit={canEdit} onChange={(s) => setImpact(item, s)} />
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">
                    {c.changeType === 'added'
                      ? 'New text: run extraction on the new version to propose obligations for it.'
                      : 'No obligations were linked to this clause.'}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
