import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FileText } from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { UploadForm } from '../components/UploadForm'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { ErrorState } from '../components/ui/ErrorState'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { apiGet, type DocumentSummary } from '../lib/api'
import { useAuth } from '../lib/auth'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { can } = useAuth()
  const canUpload = can('reviewer')

  const load = useCallback(() => {
    setError(null)
    apiGet<DocumentSummary[]>('/api/documents')
      .then((d) => {
        setDocs(d)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(load, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regulatory Documents"
        description="Official IFSCA circulars ingested and segmented into clauses with exact page coordinates for deterministic traceability."
      />

      <div className={canUpload ? 'grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]' : ''}>
        {canUpload && (
          <section aria-labelledby="upload-heading">
            <Card className="h-fit">
              <h2 id="upload-heading" className="text-base font-semibold text-ink">
                Upload a Regulation
              </h2>
              <p className="mt-1 mb-4 text-xs text-muted leading-relaxed">
                The PDF is automatically parsed into nested clauses with page coordinates so every future compliance evaluation points back to its source.
              </p>
              <UploadForm onDone={(r) => navigate(`/documents/${r.documentId}`)} />
            </Card>
          </section>
        )}

        <section aria-labelledby="docs-heading" className="space-y-3">
          <h2 id="docs-heading" className="text-base font-semibold text-ink">
            Ingested Circulars
          </h2>

          {error && <ErrorState message={error} onRetry={load} />}

          {!docs && !error && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-line bg-panel p-4 flex justify-between items-center">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-6 w-20" variant="circular" />
                </div>
              ))}
            </div>
          )}

          {docs && docs.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload an official IFSCA circular to parse clauses and extract obligations."
            />
          )}

          {docs && docs.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
              {docs.map((d) => {
                const latest = d.versions[0]
                return (
                  <li key={d.id} className="transition-colors hover:bg-surface/50">
                    <Link
                      to={`/documents/${d.id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4 focus:outline-none"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{d.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          <span className="font-medium text-brand">{d.regulator}</span> · v{latest?.versionNo ?? '–'} ·{' '}
                          {latest?._count.clauses ?? 0} clauses · {dateFmt.format(new Date(latest?.uploadedAt ?? d.createdAt))}
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
    </div>
  )
}
