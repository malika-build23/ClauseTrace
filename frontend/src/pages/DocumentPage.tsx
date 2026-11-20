import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { LayoutGrid, SplitSquareVertical } from 'lucide-react'
import { ExtractionPanel } from '../components/ExtractionPanel'
import { ObligationCard } from '../components/ObligationCard'
import { StatusBadge } from '../components/StatusBadge'
import { UploadForm } from '../components/UploadForm'
import { PdfViewer } from '../components/pdf/PdfViewer'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import {
  apiGet,
  apiPost,
  openPdf,
  type Clause,
  type ClauseList,
  type DocumentDetail,
  type Obligation,
  type ObligationList,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { highlightQuotes } from '../lib/highlight'

/** Depth of each clause in the parent/child tree (0 = top level). */
function depths(clauses: Clause[]): Map<string, number> {
  const byId = new Map(clauses.map((c) => [c.id, c]))
  const memo = new Map<string, number>()
  const depthOf = (c: Clause): number => {
    if (memo.has(c.id)) return memo.get(c.id)!
    const parent = c.parentClauseId ? byId.get(c.parentClauseId) : undefined
    const d = parent ? depthOf(parent) + 1 : 0
    memo.set(c.id, d)
    return d
  }
  clauses.forEach(depthOf)
  return memo
}

export function DocumentPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [list, setList] = useState<ClauseList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [onlyWithObligations, setOnlyWithObligations] = useState(false)

  // Split-screen PDF viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(true)
  const [selectedPage, setSelectedPage] = useState<number>(1)
  const [selectedObId, setSelectedObId] = useState<string | undefined>(undefined)

  const versionParam = params.get('version')
  const { can } = useAuth()
  const canEdit = can('reviewer')

  const load = useCallback(() => {
    setError(null)
    Promise.all([
      apiGet<DocumentDetail>(`/api/documents/${id}`),
      apiGet<ClauseList>(`/api/documents/${id}/clauses${versionParam ? `?version=${versionParam}` : ''}`),
    ])
      .then(([d, c]) => {
        setDoc(d)
        setList(c)
      })
      .catch((err: Error) => setError(err.message))
  }, [id, versionParam])

  const loadObligations = useCallback(() => {
    apiGet<ObligationList>(`/api/documents/${id}/obligations${versionParam ? `?version=${versionParam}` : ''}`)
      .then((o) => setObligations(o.obligations))
      .catch(() => setObligations([]))
  }, [id, versionParam])

  useEffect(load, [load])
  useEffect(loadObligations, [loadObligations])

  const byClause = useMemo(() => {
    const map = new Map<string, Obligation[]>()
    for (const ob of obligations) map.set(ob.clauseId, [...(map.get(ob.clauseId) ?? []), ob])
    return map
  }, [obligations])

  const depthMap = useMemo(() => depths(list?.clauses ?? []), [list])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!list) return []
    let clauses = list.clauses
    if (onlyWithObligations) clauses = clauses.filter((c) => byClause.has(c.id))
    if (!q) return clauses
    return clauses.filter((c) => c.text.toLowerCase().includes(q) || c.clauseNumber.toLowerCase().includes(q))
  }, [list, query, onlyWithObligations, byClause])

  async function retry() {
    if (!list) return
    setRetrying(true)
    try {
      await apiPost(`/api/documents/${id}/versions/${list.versionNo}/parse`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRetrying(false)
      load()
    }
  }

  if (error && !doc) {
    return <ErrorState title="Could not load document" message={error} onRetry={load} />
  }

  if (!doc || !list) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  const showPdf = (page?: number) => {
    openPdf(doc.id, list.versionNo, page).catch((err: Error) => setError(`Could not open the PDF: ${err.message}`))
  }

  const current = doc.versions.find((v) => v.versionNo === list.versionNo)

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.title}
        breadcrumbs={
          <Link to="/documents" className="text-muted hover:text-ink transition-colors font-medium">
            ← Regulatory Documents
          </Link>
        }
        description={`${doc.regulator} · uploaded by ${doc.createdBy.name} ${current ? `· ${current.fileName}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted bg-panel border border-line rounded-lg px-2.5 py-1.5">
              <span>Version:</span>
              <select
                value={list.versionNo}
                onChange={(e) => setParams({ version: e.target.value })}
                className="bg-transparent text-ink focus:outline-none"
              >
                {doc.versions.map((v) => (
                  <option key={v.versionNo} value={v.versionNo}>
                    v{v.versionNo} · {new Date(v.uploadedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setShowPdfViewer(!showPdfViewer)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand transition-colors"
            >
              {showPdfViewer ? <LayoutGrid className="h-3.5 w-3.5" /> : <SplitSquareVertical className="h-3.5 w-3.5" />}
              <span>{showPdfViewer ? 'Clauses Only' : 'Split PDF View'}</span>
            </button>

            {doc.versions.length > 1 && (
              <Link
                to={`/documents/${doc.id}/compare?from=${doc.versions.find((v) => v.versionNo < list.versionNo)?.versionNo ?? doc.versions[1].versionNo}&to=${list.versionNo > 1 ? list.versionNo : doc.versions[0].versionNo}`}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand transition-colors"
              >
                What changed
              </Link>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setShowNewVersion((s) => !s)}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover shadow-xs transition-colors"
                aria-expanded={showNewVersion}
              >
                New version
              </button>
            )}
          </div>
        }
      />

      {showNewVersion && canEdit && (
        <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink">Upload an Amended Version</h2>
          <UploadForm
            documentId={doc.id}
            compact
            onDone={(r) => {
              setShowNewVersion(false)
              setParams({ version: String(r.versionNo) })
            }}
          />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={list.parsingStatus} />
        <span className="text-xs text-muted font-medium">{list.clauses.length} clauses parsed</span>
        {canEdit && (list.parsingStatus === 'failed' || list.parsingStatus === 'pending') && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {retrying ? 'Parsing…' : 'Retry parsing'}
          </button>
        )}
      </div>

      {list.parsingStatus === 'needs_manual_split' && (
        <p className="rounded-xl border border-upcoming-border bg-upcoming-bg px-4 py-2.5 text-xs text-upcoming">
          No clause numbering was detected, so the text was split by paragraph. Check the clause boundaries against the
          PDF before relying on them.
        </p>
      )}

      {error && <ErrorState message={error} />}

      <ExtractionPanel
        documentId={doc.id}
        versionNo={list.versionNo}
        canExtract={list.parsingStatus === 'parsed' || list.parsingStatus === 'needs_manual_split'}
        allowed={canEdit}
        onFinished={loadObligations}
      />

      {obligations.length > 0 && (
        <div className="rounded-xl border border-upcoming-border bg-upcoming-bg px-4 py-2.5 text-xs text-upcoming flex items-center justify-between">
          <span>
            <b>{obligations.length}</b> AI-proposed obligation{obligations.length === 1 ? '' : 's'}. Live highlights in
            the PDF show the exact source quotes.
          </span>
          <span className="font-semibold text-ink">Review required before compiling</span>
        </div>
      )}

      {/* Main Content Area: Split View or Full Clauses View */}
      <div className={`grid gap-6 ${showPdfViewer ? 'lg:grid-cols-2' : ''}`}>
        {/* PDF Viewer Side */}
        {showPdfViewer && (
          <div className="order-2 lg:order-1 sticky top-20 self-start">
            <PdfViewer
              documentId={doc.id}
              versionNo={list.versionNo}
              initialPage={selectedPage}
              obligations={obligations}
              activeObligationId={selectedObId}
              onObligationSelect={(obId) => {
                setSelectedObId(obId)
                const ob = obligations.find((o) => o.id === obId)
                if (ob) {
                  const el = document.getElementById(`clause-${ob.clause.clauseNumber}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }}
            />
          </div>
        )}

        {/* Clauses List Side */}
        <section
          aria-labelledby="clauses-heading"
          className={`order-1 lg:order-2 rounded-2xl border border-line bg-panel shadow-sm overflow-hidden flex flex-col`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/50 px-5 py-3">
            <h2 id="clauses-heading" className="font-semibold text-ink text-sm">
              Parsed Clauses Hierarchy
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-line text-brand focus:ring-brand"
                  checked={onlyWithObligations}
                  onChange={(e) => setOnlyWithObligations(e.target.checked)}
                  disabled={obligations.length === 0}
                />
                <span>With obligations only</span>
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clauses…"
                aria-label="Search clauses"
                className="w-48 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">
              {list.clauses.length === 0 ? 'No clauses stored for this version.' : 'No clauses match your search.'}
            </p>
          ) : (
            <ol className="divide-y divide-line overflow-y-auto max-h-[750px]">
              {visible.map((c) => {
                const depth = query ? 0 : (depthMap.get(c.id) ?? 0)
                const clauseObs = byClause.get(c.id) ?? []
                return (
                  <li
                    key={c.id}
                    id={`clause-${c.clauseNumber}`}
                    className="px-5 py-3.5 hover:bg-surface/30 transition-colors"
                  >
                    <div className="flex gap-3" style={{ paddingLeft: `${Math.min(depth, 5) * 1.2}rem` }}>
                      <div className="flex shrink-0 flex-col items-start gap-1 sm:w-28">
                        <span className="rounded bg-surface border border-line px-2 py-0.5 font-mono text-xs font-bold text-ink">
                          {c.clauseNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPage(c.page)
                            if (!showPdfViewer) showPdf(c.page)
                          }}
                          className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1"
                          title="View this page in PDF"
                        >
                          page {c.page}
                        </button>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <p className={`text-sm leading-relaxed text-ink ${c.text ? '' : 'text-muted italic'}`}>
                          {c.text
                            ? highlightQuotes(c.text, clauseObs.map((o) => o.quote)).map((seg, i) =>
                                seg.marked ? (
                                  <mark key={i} className="rounded-xs bg-amber-200 dark:bg-amber-900/60 px-1 text-ink font-medium">
                                    {seg.text}
                                  </mark>
                                ) : (
                                  <span key={i}>{seg.text}</span>
                                ),
                              )
                            : 'Heading only (no text)'}
                        </p>
                        {clauseObs.map((ob) => (
                          <div
                            key={ob.id}
                            onClick={() => {
                              setSelectedPage(ob.clause.page)
                              setSelectedObId(ob.id)
                            }}
                            className={`cursor-pointer transition-all ${
                              selectedObId === ob.id ? 'ring-2 ring-brand rounded-xl' : ''
                            }`}
                          >
                            <ObligationCard ob={ob} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
