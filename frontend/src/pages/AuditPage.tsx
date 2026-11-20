import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiGet } from '../lib/api'

type Entry = {
  id: string
  eventType: string
  objectType: string
  objectId: string
  payloadJson: Record<string, unknown>
  createdAt: string
  actor: { name: string; email: string } | null
}
type Facets = { eventTypes: string[]; objectTypes: string[]; actors: { email: string; name: string }[] }

const FILTERS = ['eventType', 'objectType', 'actor', 'from', 'to'] as const
const input = 'rounded-md border border-line bg-panel px-2 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none'

/** Link to the object an entry is about, where the app has a page for it. */
function objectLink(e: Entry): string | null {
  const p = e.payloadJson
  switch (e.objectType) {
    case 'obligation':
      return `/obligations/${e.objectId}`
    case 'evaluation':
      return `/evaluations/${e.objectId}`
    case 'entity_profile':
      return `/profiles?id=${e.objectId}`
    case 'document':
      return `/documents/${e.objectId}`
    case 'document_version':
      return typeof p.documentId === 'string' ? `/documents/${p.documentId}` : null
    case 'rule':
      return typeof p.ruleKey === 'string' ? `/rules?all=true&key=${encodeURIComponent(p.ruleKey)}` : null
    default:
      return null
  }
}

export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const [facets, setFacets] = useState<Facets | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const query = FILTERS.flatMap((k) => (params.get(k) ? [`${k}=${encodeURIComponent(params.get(k)!)}`] : [])).join('&')
  const objectId = params.get('objectId')
  const fullQuery = [query, objectId ? `objectId=${encodeURIComponent(objectId)}` : ''].filter(Boolean).join('&')

  const load = useCallback(
    (before?: string) => {
      setLoading(true)
      apiGet<{ entries: Entry[]; nextBefore: string | null }>(`/api/audit?${fullQuery}${before ? `&before=${encodeURIComponent(before)}` : ''}`)
        .then((r) => {
          setEntries((prev) => (before ? [...prev, ...r.entries] : r.entries))
          setNextBefore(r.nextBefore)
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false))
    },
    [fullQuery],
  )
  useEffect(() => load(), [load])
  useEffect(() => {
    apiGet<Facets>('/api/audit/facets')
      .then(setFacets)
      .catch(() => setFacets({ eventTypes: [], objectTypes: [], actors: [] }))
  }, [])

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="mt-1 text-sm text-muted">
          Every upload, extraction, review, rule change, evaluation and sign-in. Append-only: the database rejects edits and deletions.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-4 shadow-sm">
        <label className="text-xs text-muted">
          Event
          <select className={`${input} mt-1 block`} value={params.get('eventType') ?? ''} onChange={(e) => set('eventType', e.target.value)}>
            <option value="">All</option>
            {facets?.eventTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Object
          <select className={`${input} mt-1 block`} value={params.get('objectType') ?? ''} onChange={(e) => set('objectType', e.target.value)}>
            <option value="">All</option>
            {facets?.objectTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Who
          <select className={`${input} mt-1 block`} value={params.get('actor') ?? ''} onChange={(e) => set('actor', e.target.value)}>
            <option value="">Everyone</option>
            <option value="system">System / unknown</option>
            {facets?.actors.map((a) => (
              <option key={a.email} value={a.email}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          From
          <input type="date" className={`${input} mt-1 block`} value={params.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label className="text-xs text-muted">
          To
          <input type="date" className={`${input} mt-1 block`} value={params.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} />
        </label>
        {(query || objectId) && (
          <button type="button" className="text-sm text-muted underline" onClick={() => setParams({})}>
            Clear filters
          </button>
        )}
        {objectId && <p className="w-full text-xs text-muted">Showing one object: {objectId}</p>}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Object</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e) => {
              const link = objectLink(e)
              return (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-muted">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.eventType}</td>
                  <td className="px-4 py-2 text-xs">
                    {e.objectType}{' '}
                    {link ? (
                      <Link to={link} className="font-mono text-brand hover:underline">
                        {e.objectId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-muted">{e.objectId.slice(0, 8)}</span>
                    )}
                    <button type="button" className="ml-2 text-muted underline" onClick={() => set('objectId', e.objectId)} title="Show the full history of this object">
                      history
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs">{e.actor?.name ?? 'System'}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    <button type="button" className="text-brand underline" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                      {open === e.id ? 'Hide' : 'Details'}
                    </button>
                    {open === e.id && (
                      <pre className="mt-2 max-w-xl overflow-x-auto rounded bg-surface p-2 text-left text-[11px] whitespace-pre-wrap">
                        {JSON.stringify(e.payloadJson, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No entries match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nextBefore && (
        <button type="button" disabled={loading} onClick={() => load(nextBefore)} className="text-sm text-brand underline disabled:opacity-50">
          Load older entries
        </button>
      )}
    </div>
  )
}
