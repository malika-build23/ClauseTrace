import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ExtractionPanel } from '../components/ExtractionPanel'
import { ObligationCard } from '../components/ObligationCard'
import { StatusBadge } from '../components/StatusBadge'
import { UploadForm } from '../components/UploadForm'
import {
  apiGet,
  apiPost,
  pdfUrl,
  type Clause,
  type ClauseList,
  type DocumentDetail,
  type Obligation,
  type ObligationList,
} from '../lib/api'
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

  const versionParam = params.get('version')

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
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">Could not load this document: {error}</p>
        <Link to="/" className="text-sm text-brand underline">
          Back to documents
        </Link>
      </div>
    )
  }
  if (!doc || !list) return <p className="text-sm text-muted">Loading…</p>

  const current = doc.versions.find((v) => v.versionNo === list.versionNo)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Documents
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{doc.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {doc.regulator} · uploaded by {doc.createdBy.name}
              {current && <> · {current.fileName}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Version</span>
              <select
                value={list.versionNo}
                onChange={(e) => setParams({ version: e.target.value })}
                className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
              >
                {doc.versions.map((v) => (
                  <option key={v.versionNo} value={v.versionNo}>
                    v{v.versionNo} · {new Date(v.uploadedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <a
              href={pdfUrl(doc.id, list.versionNo)}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm hover:bg-surface"
            >
              View PDF
            </a>
            <button
              type="button"
              onClick={() => setShowNewVersion((s) => !s)}
              className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm hover:bg-surface"
              aria-expanded={showNewVersion}
            >
              New version
            </button>
          </div>
        </div>
      </div>

      {showNewVersion && (
        <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <h2 className="mb-3 font-medium">Upload an amended version</h2>
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
        <span className="text-sm text-muted">{list.clauses.length} clauses</span>
        {(list.parsingStatus === 'failed' || list.parsingStatus === 'pending') && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {retrying ? 'Parsing…' : 'Retry parsing'}
          </button>
        )}
      </div>

      {list.parsingStatus === 'needs_manual_split' && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-upcoming">
          No clause numbering was detected, so the text was split by paragraph. Check the clause boundaries against the
          PDF before relying on them.
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}

      <ExtractionPanel
        documentId={doc.id}
        versionNo={list.versionNo}
        canExtract={list.parsingStatus === 'parsed' || list.parsingStatus === 'needs_manual_split'}
        onFinished={loadObligations}
      />

      {obligations.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-upcoming">
          {obligations.length} AI-proposed obligation{obligations.length === 1 ? '' : 's'}. Highlighted text is the
          exact source quote. Confidence is a review aid, not proof of correctness. Nothing here is approved yet.
        </p>
      )}

      <section aria-labelledby="clauses-heading" className="rounded-xl border border-line bg-panel shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="clauses-heading" className="font-medium">
            Clauses
          </h2>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={onlyWithObligations}
              onChange={(e) => setOnlyWithObligations(e.target.checked)}
              disabled={obligations.length === 0}
            />
            Only clauses with obligations
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clauses…"
            aria-label="Search clauses"
            className="w-full max-w-xs rounded-md border border-line px-3 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
          />
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            {list.clauses.length === 0 ? 'No clauses stored for this version.' : 'No clauses match your search.'}
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {visible.map((c) => {
              const depth = query ? 0 : (depthMap.get(c.id) ?? 0)
              return (
                <li key={c.id} id={`clause-${c.clauseNumber}`} className="px-4 py-3">
                  <div className="flex gap-3" style={{ paddingLeft: `${Math.min(depth, 5) * 1.25}rem` }}>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:w-28">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs break-all">
                        {c.clauseNumber}
                      </span>
                      <a
                        href={`${pdfUrl(doc.id, list.versionNo)}#page=${c.page}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted hover:text-brand"
                        title="Open the PDF at this page"
                      >
                        p. {c.page}
                      </a>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className={`text-sm leading-relaxed ${c.text ? '' : 'text-muted italic'}`}>
                        {c.text
                          ? highlightQuotes(c.text, (byClause.get(c.id) ?? []).map((o) => o.quote)).map((seg, i) =>
                              seg.marked ? (
                                <mark key={i} className="rounded-sm bg-yellow-100 px-0.5 text-ink">
                                  {seg.text}
                                </mark>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              ),
                            )
                          : 'Heading only (no text)'}
                      </p>
                      {byClause.get(c.id)?.map((ob) => <ObligationCard key={ob.id} ob={ob} />)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
