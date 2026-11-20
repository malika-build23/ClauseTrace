import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, CheckCircle2, ChevronRight, Layers, RefreshCw, XCircle } from 'lucide-react'
import {
  apiGet,
  apiPost,
  apiSend,
  type ChangeEvent,
  type ChangesResponse,
  type DocumentDetail,
  type ImpactItem,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { SideBySideDiff } from '../components/diff/SideBySideDiff'
import { BlastRadiusView } from '../components/diff/BlastRadiusView'
import { isRenumberedOnly } from '../lib/changeDetection'

export function ComparePage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { can } = useAuth()
  const canEdit = can('reviewer')

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [data, setData] = useState<ChangesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)

  const from = params.get('from')
  const to = params.get('to')
  const query = `${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`

  const load = useCallback(() => {
    setError(null)
    apiGet<DocumentDetail>(`/api/documents/${id}`)
      .then(setDoc)
      .catch((err: Error) => setError(err.message))
    apiGet<ChangesResponse>(`/api/documents/${id}/changes?${query}`)
      .then((res) => {
        setData(res)
        if (res.changes.length > 0 && !selectedChangeId) {
          setSelectedChangeId(res.changes[0].id)
        }
      })
      .catch((err: Error) => setError(err.message))
  }, [id, query, selectedChangeId])

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
    await apiSend('PATCH', `/api/changes/${change.id}`, { status }).catch((err: Error) =>
      setError(err.message),
    )
    load()
  }

  async function setImpact(item: ImpactItem, reviewStatus: ImpactItem['reviewStatus']) {
    await apiSend('PATCH', `/api/impact-items/${item.id}`, { reviewStatus }).catch((err: Error) =>
      setError(err.message),
    )
    load()
  }

  if (error && !data) {
    return (
      <div className="py-6">
        <ErrorState
          title="Failed to load document comparison"
          message={error}
          onRetry={load}
        />
      </div>
    )
  }

  if (!data || !doc) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const selectedChange = data.changes.find((c) => c.id === selectedChangeId) ?? data.changes[0] ?? null

  const count = (t: ChangeEvent['changeType']) =>
    data.changes.filter((c) => c.changeType === t && !isRenumberedOnly(c)).length
  const movedCount = data.changes.filter((c) => isRenumberedOnly(c)).length
  const pendingCount = data.changes.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <Link to={`/documents/${id}`} className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> {doc.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Regulatory Amendment Diff: Version {data.fromNo ?? '?'} → {data.toNo ?? '?'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Word-level alignment detects textual modifications and distinguishes moved/renumbered clauses.
              Approved obligations and active rules do not change automatically.
            </p>
          </div>
          {canEdit && data.compared && (
            <button
              type="button"
              onClick={compare}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              Re-run Alignment Diff
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-fail">
          {error}
        </div>
      )}

      {data.fromNo === null ? (
        <EmptyState
          icon={Layers}
          title="Single Version Document"
          description="This document only has one version registered in ClauseTrace. Upload an amended version to compare clauses and evaluate blast radius."
        />
      ) : !data.compared && data.changes.length === 0 ? (
        <Card className="p-8 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted opacity-60" />
          <h3 className="mt-3 text-base font-semibold text-ink">Comparison Not Yet Computed</h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            These two versions have not yet been aligned. Run the deterministic diff algorithm to inspect clause amendments and downstream impact.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={compare}
              disabled={busy}
              className="mt-4 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {busy ? 'Running Alignment Diff…' : 'Compare Versions Now'}
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* Summary Metric Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-upcoming dark:border-amber-800 dark:bg-amber-950/40">
              {count('modified')} Modified
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-pass dark:border-emerald-800 dark:bg-emerald-950/40">
              {count('added')} Added
            </span>
            <span className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-fail dark:border-red-800 dark:bg-red-950/40">
              {count('removed')} Removed
            </span>
            {movedCount > 0 && (
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                {movedCount} Moved / Renumbered
              </span>
            )}
            <span className="text-muted ml-1">· {pendingCount} awaiting reviewer confirmation</span>
          </div>

          {data.changes.length === 0 ? (
            <EmptyState
              title="No Textual Changes Detected"
              description="The deterministic clause alignment found 100% identical clause text between these two versions."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Change List (5 cols on lg) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted uppercase tracking-wider px-1">
                  <span>Detected Clause Changes ({data.changes.length})</span>
                  <span>Select to inspect</span>
                </div>

                <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
                  {data.changes.map((c) => {
                    const isMoved = isRenumberedOnly(c)
                    const isSelected = selectedChange?.id === c.id

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedChangeId(c.id)}
                        className={`rounded-xl border p-3.5 cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'border-teal bg-panel ring-2 ring-teal/20 shadow-md'
                            : 'border-line bg-panel hover:border-brand/40 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {isMoved ? (
                              <span className="rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-bold uppercase border border-sky-200">
                                MOVED
                              </span>
                            ) : (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  c.changeType === 'added'
                                    ? 'bg-emerald-100 text-pass dark:bg-emerald-950'
                                    : c.changeType === 'removed'
                                    ? 'bg-red-100 text-fail dark:bg-red-950'
                                    : 'bg-amber-100 text-upcoming dark:bg-amber-950'
                                }`}
                              >
                                {c.changeType}
                              </span>
                            )}
                            <span className="font-mono text-xs font-semibold text-ink">
                              Clause {c.clauseRef}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                                c.status === 'confirmed'
                                  ? 'bg-teal-50 text-teal'
                                  : c.status === 'dismissed'
                                  ? 'bg-gray-100 text-muted'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {c.status}
                            </span>
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${
                                isSelected ? 'text-teal rotate-90' : 'text-muted'
                              }`}
                            />
                          </div>
                        </div>

                        <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed">
                          {c.summary ?? 'Amendment details'}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted border-t border-line/60 pt-1.5">
                          <span>
                            {c.impactItems.length} affected obligation{c.impactItems.length === 1 ? '' : 's'}
                          </span>
                          {canEdit && c.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setChange(c, 'confirmed')
                                }}
                                className="text-teal hover:underline font-medium inline-flex items-center gap-0.5"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Confirm
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setChange(c, 'dismissed')
                                }}
                                className="text-muted hover:text-ink underline inline-flex items-center gap-0.5"
                              >
                                <XCircle className="h-3 w-3" /> Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Diff & Blast Radius View (7 cols on lg) */}
              <div className="lg:col-span-7 space-y-4">
                {selectedChange ? (
                  <>
                    {/* Side-by-side Clause Diff Card */}
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-line pb-2">
                        <div>
                          <h3 className="font-semibold text-sm text-ink">
                            Clause {selectedChange.clauseRef} Text Comparison
                          </h3>
                          <p className="text-xs text-muted">
                            Word-level diff across versions {data.fromNo} and {data.toNo}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-muted">
                          {selectedChange.changeType.toUpperCase()}
                        </span>
                      </div>

                      <SideBySideDiff
                        oldText={selectedChange.oldText}
                        newText={selectedChange.newText}
                        fromVersionNo={data.fromNo}
                        toVersionNo={data.toNo}
                        changeType={selectedChange.changeType}
                        isMoved={isRenumberedOnly(selectedChange)}
                      />
                    </Card>

                    {/* Blast Radius Panel with Governance Alert */}
                    <BlastRadiusView
                      change={selectedChange}
                      canEdit={canEdit}
                      onSetImpact={setImpact}
                      onSetChangeStatus={(status) => setChange(selectedChange, status)}
                    />
                  </>
                ) : (
                  <Card className="p-8 text-center text-muted text-sm">
                    Select a changed clause from the list to view its side-by-side diff and blast radius.
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
