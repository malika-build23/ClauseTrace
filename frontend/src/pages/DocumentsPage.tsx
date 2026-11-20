import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { StatusBadge } from '../components/StatusBadge'
import { UploadForm } from '../components/UploadForm'
import { apiGet, type DocumentSummary } from '../lib/api'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    apiGet<DocumentSummary[]>('/api/documents')
      .then((d) => {
        setDocs(d)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section aria-labelledby="upload-heading" className="h-fit rounded-xl border border-line bg-panel p-5 shadow-sm">
        <h1 id="upload-heading" className="text-lg font-semibold">
          Upload a regulation
        </h1>
        <p className="mt-1 mb-4 text-sm text-muted">
          The PDF is split into clauses with page numbers so every later result can point back to its source.
        </p>
        <UploadForm onDone={(r) => navigate(`/documents/${r.documentId}`)} />
      </section>

      <section aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="mb-3 text-lg font-semibold">
          Documents
        </h2>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">Could not load documents: {error}</p>}
        {!docs && !error && <p className="text-sm text-muted">Loading…</p>}
        {docs && docs.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No documents yet. Upload an IFSCA circular to get started.
          </p>
        )}
        {docs && docs.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
            {docs.map((d) => {
              const latest = d.versions[0]
              return (
                <li key={d.id}>
                  <Link
                    to={`/documents/${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hover:bg-surface focus:bg-surface focus:outline-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.title}</p>
                      <p className="text-xs text-muted">
                        {d.regulator} · v{latest?.versionNo ?? '–'} · {latest?._count.clauses ?? 0} clauses ·{' '}
                        {dateFmt.format(new Date(latest?.uploadedAt ?? d.createdAt))}
                      </p>
                    </div>
                    {latest && <StatusBadge status={latest.parsingStatus} />}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
