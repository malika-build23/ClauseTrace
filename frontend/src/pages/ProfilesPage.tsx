import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ResultBadge } from '../components/ResultBadge'
import { SimulationComparison } from '../components/SimulationComparison'
import { apiGet, apiPost, apiSend, type EntityProfile, type EvaluationRow, type ProfileValue, type RuleRow } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ruleFields, ruleSummary } from '../lib/rules'

type Row = { key: string; kind: 'number' | 'text' | 'true' | 'false' | 'null'; value: string }

const toRows = (data: Record<string, ProfileValue>): Row[] =>
  Object.entries(data).map(([key, v]) => ({
    key,
    kind: v === null ? 'null' : v === true ? 'true' : v === false ? 'false' : typeof v === 'number' ? 'number' : 'text',
    value: typeof v === 'number' || typeof v === 'string' ? String(v) : '',
  }))

function toData(rows: Row[]): Record<string, ProfileValue> {
  const out: Record<string, ProfileValue> = {}
  for (const r of rows) {
    const key = r.key.trim()
    if (!key) continue
    out[key] = r.kind === 'null' ? null : r.kind === 'true' ? true : r.kind === 'false' ? false : r.kind === 'number' ? Number(r.value) : r.value
  }
  return out
}

const today = () => new Date().toISOString().slice(0, 10)
const input = 'rounded-md border border-line bg-panel px-2 py-1.5 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none disabled:bg-surface'

export function ProfilesPage() {
  const { can } = useAuth()
  const canEdit = can('reviewer')
  const [params, setParams] = useSearchParams()
  const [profiles, setProfiles] = useState<EntityProfile[] | null>(null)
  const [rules, setRules] = useState<RuleRow[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [results, setResults] = useState<EvaluationRow[] | null>(null)
  const [baseline, setBaseline] = useState<EvaluationRow[] | null>(null)
  const [date, setDate] = useState(today())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedId = params.get('id')
  const selected = profiles?.find((p) => p.id === selectedId) ?? profiles?.[0] ?? null

  const load = useCallback(() => {
    apiGet<EntityProfile[]>('/api/entity-profiles?includeSimulation=true')
      .then(setProfiles)
      .catch((err: Error) => setError(err.message))
    apiGet<RuleRow[]>('/api/rules?active=true')
      .then(setRules)
      .catch(() => setRules([]))
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    if (!selected) return
    setRows(toRows(selected.dataJson))
    setResults(null)
    setMessage(null)
    apiGet<EvaluationRow[]>(`/api/evaluations?latest=true&includeSimulation=true&profileId=${selected.id}`)
      .then(setResults)
      .catch(() => setResults([]))
    setBaseline(null)
    if (selected.isSimulation && selected.baseProfileId) {
      apiGet<EvaluationRow[]>(`/api/evaluations?latest=true&profileId=${selected.baseProfileId}`)
        .then(setBaseline)
        .catch(() => setBaseline([]))
    }
  }, [selected])

  const neededFields = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of rules) {
      if (selected && r.definitionJson.applies_to.length && !r.definitionJson.applies_to.includes(selected.category.name)) continue
      for (const f of ruleFields(r.definitionJson)) map.set(f, [...(map.get(f) ?? []), r.ruleKey])
    }
    return map
  }, [rules, selected])
  const presentKeys = new Set(rows.map((r) => r.key.trim()))
  const missing = [...neededFields.keys()].filter((f) => !presentKeys.has(f))
  const dirty = selected ? JSON.stringify(toData(rows)) !== JSON.stringify(selected.dataJson) : false

  async function save() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await apiSend('PATCH', `/api/entity-profiles/${selected.id}`, { data: toData(rows) })
      setMessage('Saved. Past results keep the values they were evaluated with.')
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function evaluate() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const run = await apiPost<{ evaluations: EvaluationRow[] }>('/api/evaluations', { profileId: selected.id, evaluationDate: date })
      setMessage(`Evaluated ${run.evaluations.length} rule(s) as of ${date}.`)
      setResults(await apiGet<EvaluationRow[]>(`/api/evaluations?latest=true&includeSimulation=true&profileId=${selected.id}`))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeSimulation() {
    if (!selected?.isSimulation) return
    setBusy(true)
    try {
      await apiSend('DELETE', `/api/entity-profiles/${selected.id}`)
      setParams({})
      load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function simulate() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const copy = await apiPost<EntityProfile>(`/api/entity-profiles/${selected.id}/simulate`, {})
      load()
      setParams({ id: copy.id })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!profiles) return <p className="text-sm text-muted">{error ?? 'Loading…'}</p>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entity profiles</h1>
        <p className="mt-1 text-sm text-muted">Fictional entities used for evaluation. All values are illustrative.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Profiles" className="h-fit space-y-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setParams({ id: p.id })}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${selected?.id === p.id ? 'bg-panel font-medium shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel'}`}
            >
              {p.isSimulation && <span className="mr-1 rounded bg-purple-50 px-1 text-[10px] font-semibold text-simulation">SIMULATION</span>}
              {p.name}
            </button>
          ))}
        </nav>

        {selected && (
          <div className="space-y-5">
            {selected.isSimulation && (
              <p className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-simulation">
                SIMULATION: a what-if copy. Its results are kept out of the dashboard and compliance records.
              </p>
            )}
            <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">
                  {selected.name} <span className="text-sm font-normal text-muted">· {selected.category.name}</span>
                </h2>
                {canEdit && selected.isSimulation && (
                  <button type="button" onClick={removeSimulation} disabled={busy} className="text-sm text-fail underline disabled:opacity-50">
                    Delete simulation
                  </button>
                )}
                {canEdit && !selected.isSimulation && (
                  <button type="button" onClick={simulate} disabled={busy} className="text-sm text-simulation underline disabled:opacity-50">
                    Create what-if copy
                  </button>
                )}
              </div>

              {missing.length > 0 && (
                <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-insufficient">
                  Fields read by active rules but missing here (results will be “insufficient data”):{' '}
                  {missing.map((f) => (
                    <code key={f} className="mr-1">
                      {f}
                    </code>
                  ))}
                </p>
              )}

              <table className="mt-4 w-full text-sm">
                <thead className="text-left text-xs text-muted uppercase">
                  <tr>
                    <th className="pb-2 font-medium">Field</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Value</th>
                    <th className="pb-2">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input
                          aria-label="Field name"
                          className={`${input} w-full font-mono`}
                          value={r.key}
                          disabled={!canEdit}
                          onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                        />
                        {neededFields.has(r.key) && <span className="text-[10px] text-muted">used by {neededFields.get(r.key)!.length} rule(s)</span>}
                      </td>
                      <td className="py-1 pr-2">
                        <select
                          aria-label="Type"
                          className={input}
                          value={r.kind}
                          disabled={!canEdit}
                          onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as Row['kind'] } : x)))}
                        >
                          <option value="number">number</option>
                          <option value="text">text / date</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                          <option value="null">null (not done)</option>
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        {(r.kind === 'number' || r.kind === 'text') && (
                          <input
                            aria-label="Value"
                            className={`${input} w-full`}
                            type={r.kind === 'number' ? 'number' : 'text'}
                            step="any"
                            value={r.value}
                            disabled={!canEdit}
                            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                          />
                        )}
                      </td>
                      <td className="py-1 text-right">
                        {canEdit && (
                          <button type="button" aria-label={`Remove ${r.key}`} className="px-2 text-muted hover:text-fail" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="text-sm text-brand underline" onClick={() => setRows([...rows, { key: missing[0] ?? '', kind: 'number', value: '' }])}>
                    Add field
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || busy}
                    className="ml-auto rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-[#0c4d4f] transition-colors disabled:opacity-50"
                  >
                    Save data
                  </button>
                </div>
              )}
            </section>

            {selected.isSimulation && results && baseline && <SimulationComparison baseline={baseline} scenario={results} />}

            <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <h2 className="mr-auto font-medium">Latest results</h2>
                {canEdit && (
                  <>
                    <label className="text-sm">
                      <span className="block text-xs text-muted">Evaluation date</span>
                      <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    <button
                      type="button"
                      onClick={evaluate}
                      disabled={busy || dirty || rules.length === 0}
                      title={dirty ? 'Save the data first' : undefined}
                      className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-[#0c4d4f] transition-colors disabled:opacity-50"
                    >
                      Evaluate rules
                    </button>
                  </>
                )}
              </div>
              <div aria-live="polite" className="mt-2">
                {message && <p className="text-sm text-pass">{message}</p>}
                {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
              </div>
              {results && results.length === 0 && <p className="mt-3 text-sm text-muted">Not evaluated yet.</p>}
              {results && results.length > 0 && (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {results.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 py-2">
                      <ResultBadge result={e.result} />
                      <Link to={`/evaluations/${e.id}`} className="min-w-0 flex-1 font-mono text-xs text-brand hover:underline">
                        {ruleSummary(e.rule.definitionJson)}
                      </Link>
                      <span className="text-xs text-muted">
                        clause {e.detailsJson.source.clause} · {e.evaluationDate.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
