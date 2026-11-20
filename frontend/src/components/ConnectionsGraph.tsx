import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiGet, type GraphNode, type GraphResponse } from '../lib/api'

const COLUMNS: { title: string; kinds: GraphNode['kind'][] }[] = [
  { title: 'Source', kinds: ['regulator', 'document', 'version', 'clause'] },
  { title: 'Obligations', kinds: ['obligation'] },
  { title: 'Applies to & rules', kinds: ['category', 'rule'] },
  { title: 'Latest results', kinds: ['result'] },
]

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  regulator: 'Regulator',
  document: 'Document',
  version: 'Version',
  clause: 'Clause',
  obligation: 'Obligation',
  category: 'Entity category',
  rule: 'Rule',
  result: 'Result',
}

/**
 * Knowledge-graph view of one clause's neighbourhood, laid out left to right
 * (source -> obligations -> rules -> results). Columns stack on narrow screens.
 * It also answers "if this clause changes, what is affected?".
 */
export function ConnectionsGraph({ obligationId, highlight }: { obligationId: string; highlight?: string }) {
  const [graph, setGraph] = useState<GraphResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<GraphResponse>(`/api/graph/obligation/${obligationId}`)
      .then(setGraph)
      .catch((err: Error) => setError(err.message))
  }, [obligationId])

  if (error) return <p className="text-sm text-fail">{error}</p>
  if (!graph) return <p className="text-sm text-muted">Loading connections…</p>

  const incoming = new Map<string, string>()
  for (const e of graph.edges) incoming.set(e.to, e.label)

  return (
    <div className="space-y-3">
      <p className="text-sm">
        If this clause changes: <b>{graph.impact.obligations}</b> obligation(s), <b>{graph.impact.rules}</b> active rule(s) and{' '}
        <b>{graph.impact.entities}</b> evaluated entit{graph.impact.entities === 1 ? 'y' : 'ies'} would need review.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        {COLUMNS.map((col, i) => {
          const nodes = graph.nodes.filter((n) => col.kinds.includes(n.kind))
          return (
            <div key={col.title} className="relative">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                {col.title}
                {i < COLUMNS.length - 1 && <span className="ml-1 hidden md:inline" aria-hidden>→</span>}
              </p>
              {nodes.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-2 text-xs text-muted">None yet</p>
              ) : (
                <ul className="space-y-2">
                  {nodes.map((n) => {
                    const body = (
                      <>
                        <span className="block text-[10px] tracking-wide text-muted uppercase">
                          {KIND_LABEL[n.kind]}
                          {incoming.get(n.id) && ` · ${incoming.get(n.id)}`}
                        </span>
                        <span className="block text-xs font-medium break-words">{n.label}</span>
                        {n.detail && <span className="block truncate text-[11px] text-muted">{n.detail}</span>}
                      </>
                    )
                    const cls = `block rounded-md border px-2 py-1.5 ${n.id === `ob:${highlight}` ? 'border-brand ring-1 ring-brand' : 'border-line'} bg-panel`
                    return (
                      <li key={n.id}>
                        {n.href ? (
                          <Link to={n.href} className={`${cls} hover:border-brand`}>
                            {body}
                          </Link>
                        ) : (
                          <div className={cls}>{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
