import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  Minus,
} from 'lucide-react'
import {
  apiGet,
  type EvaluationResult,
  type EvaluationRow,
  type EntityProfile,
  type RuleRow,
} from '../../lib/api'
import { ruleSummary } from '../../lib/rules'
import { Skeleton } from '../ui/Skeleton'
import { ErrorState } from '../ui/ErrorState'
import { HeatmapDrawer, type SelectedHeatmapCell } from './HeatmapDrawer'
import { exportHeatmapToCsv, exportHeatmapToPng, type HeatmapExportRow } from './HeatmapExport'

type Density = 'compact' | 'normal' | 'comfortable'

const CELL_ICON: Record<EvaluationResult, typeof CheckCircle2> = {
  PASS: CheckCircle2,
  UPCOMING_DEADLINE: Clock,
  FAIL: AlertCircle,
  INSUFFICIENT_DATA: HelpCircle,
}

const CELL_STYLE: Record<EvaluationResult, { bg: string; text: string; border: string; label: string }> = {
  PASS: { bg: 'bg-pass-bg', text: 'text-pass', border: 'border-pass-border', label: 'Pass' },
  UPCOMING_DEADLINE: { bg: 'bg-upcoming-bg', text: 'text-upcoming', border: 'border-upcoming-border', label: 'Upcoming' },
  FAIL: { bg: 'bg-fail-bg', text: 'text-fail', border: 'border-fail-border', label: 'Fail' },
  INSUFFICIENT_DATA: { bg: 'bg-insufficient-bg', text: 'text-insufficient', border: 'border-insufficient-border', label: 'Missing' },
}

export function ComplianceHeatmap({ className = '' }: { className?: string }) {
  const tableContainerRef = useRef<HTMLDivElement | null>(null)

  const [profiles, setProfiles] = useState<EntityProfile[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<EvaluationResult | 'all'>('all')
  const [query, setQuery] = useState('')
  const [sortByRisk, setSortByRisk] = useState(true)
  const [density, setDensity] = useState<Density>('normal')

  const [selectedCell, setSelectedCell] = useState<SelectedHeatmapCell | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiGet<EntityProfile[]>('/api/entity-profiles'),
      apiGet<RuleRow[]>('/api/rules?active=true'),
      apiGet<EvaluationRow[]>('/api/evaluations?latest=true'),
    ])
      .then(([p, r, e]) => {
        setProfiles(p)
        setRules(r)
        setEvaluations(e)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Lookup map: `${ruleKey}|${profileId}` -> EvaluationRow
  const evalMap = useMemo(() => {
    const map = new Map<string, EvaluationRow>()
    for (const ev of evaluations) {
      map.set(`${ev.rule.ruleKey}|${ev.profileId}`, ev)
    }
    return map
  }, [evaluations])

  // Summary counts
  const summary = useMemo(() => {
    let passes = 0
    let fails = 0
    let upcoming = 0
    let missing = 0

    for (const ev of evaluations) {
      if (ev.result === 'PASS') passes++
      else if (ev.result === 'FAIL') fails++
      else if (ev.result === 'UPCOMING_DEADLINE') upcoming++
      else if (ev.result === 'INSUFFICIENT_DATA') missing++
    }

    return {
      totalEntities: profiles.length,
      totalRules: rules.length,
      totalChecks: evaluations.length,
      passes,
      fails,
      upcoming,
      missing,
    }
  }, [profiles, rules, evaluations])

  // Entity Risk Scoring for sorting
  const entityRiskScores = useMemo(() => {
    const scores = new Map<string, number>()
    for (const p of profiles) {
      let score = 0
      for (const r of rules) {
        const ev = evalMap.get(`${r.ruleKey}|${p.id}`)
        if (ev?.result === 'FAIL') score += 10
        else if (ev?.result === 'UPCOMING_DEADLINE') score += 5
        else if (ev?.result === 'INSUFFICIENT_DATA') score += 2
      }
      scores.set(p.id, score)
    }
    return scores
  }, [profiles, rules, evalMap])

  // Filtered and Sorted Profiles
  const visibleProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = profiles.filter((p) => !p.isSimulation)
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.name.toLowerCase().includes(q))
    }
    if (sortByRisk) {
      return [...list].sort((a, b) => (entityRiskScores.get(b.id) ?? 0) - (entityRiskScores.get(a.id) ?? 0))
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [profiles, query, sortByRisk, entityRiskScores])

  // Filtered Rules
  const visibleRules = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rules
    return rules.filter(
      (r) =>
        r.ruleKey.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        ruleSummary(r.definitionJson).toLowerCase().includes(q),
    )
  }, [rules, query])

  const handleExportCsv = () => {
    const exportRows: HeatmapExportRow[] = []
    for (const p of visibleProfiles) {
      for (const r of visibleRules) {
        const ev = evalMap.get(`${r.ruleKey}|${p.id}`)
        if (statusFilter !== 'all' && ev?.result !== statusFilter) continue
        exportRows.push({
          entityName: p.name,
          entityCategory: p.category.name,
          ruleKey: r.ruleKey,
          ruleType: r.type,
          result: ev?.result ?? 'NOT_EVALUATED',
          explanation: ev?.detailsJson?.explanation ?? 'Not evaluated yet',
          evaluationDate: ev ? ev.evaluationDate.slice(0, 10) : '–',
        })
      }
    }
    exportHeatmapToCsv(exportRows)
  }

  const handleExportPng = () => {
    if (tableContainerRef.current) {
      exportHeatmapToPng(tableContainerRef.current)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Could not load compliance heatmap" message={error} onRetry={loadData} />
  }

  return (
    <div className={`space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-sm ${className}`}>
      {/* Header & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-bold text-ink font-display">Compliance Matrix Heatmap</h2>
          <p className="text-xs text-muted">
            Matrix of Fund Management Entities against active rules. Dual-coded with icons and high-contrast indicators.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-brand" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-brand" />
            <span>Export PNG</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 text-xs">
        <div className="rounded-xl border border-line bg-surface p-2.5">
          <span className="text-[10px] font-bold text-muted uppercase">Entities</span>
          <p className="text-lg font-bold text-ink font-display">{summary.totalEntities}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-2.5">
          <span className="text-[10px] font-bold text-muted uppercase">Active Rules</span>
          <p className="text-lg font-bold text-ink font-display">{summary.totalRules}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-2.5">
          <span className="text-[10px] font-bold text-muted uppercase">Evaluations</span>
          <p className="text-lg font-bold text-ink font-display">{summary.totalChecks}</p>
        </div>
        <div className="rounded-xl border border-pass-border bg-pass-bg p-2.5 text-pass">
          <span className="text-[10px] font-bold uppercase">Pass</span>
          <p className="text-lg font-bold font-display">{summary.passes}</p>
        </div>
        <div className="rounded-xl border border-fail-border bg-fail-bg p-2.5 text-fail">
          <span className="text-[10px] font-bold uppercase">Fail</span>
          <p className="text-lg font-bold font-display">{summary.fails}</p>
        </div>
        <div className="rounded-xl border border-upcoming-border bg-upcoming-bg p-2.5 text-upcoming">
          <span className="text-[10px] font-bold uppercase">Upcoming</span>
          <p className="text-lg font-bold font-display">{summary.upcoming}</p>
        </div>
        <div className="rounded-xl border border-insufficient-border bg-insufficient-bg p-2.5 text-insufficient">
          <span className="text-[10px] font-bold uppercase">Missing</span>
          <p className="text-lg font-bold font-display">{summary.missing}</p>
        </div>
      </div>

      {/* Toolbar: Filters & Density Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/60 border border-line rounded-xl p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entity or rule…"
              aria-label="Search matrix"
              className="pl-8 pr-3 py-1 rounded-lg border border-line bg-panel text-xs text-ink focus:border-brand focus:outline-none w-44 sm:w-56"
            />
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-line">
            <Filter className="h-3.5 w-3.5 text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EvaluationResult | 'all')}
              aria-label="Filter matrix by status"
              className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">All Outcomes</option>
              <option value="PASS">Pass Only</option>
              <option value="FAIL">Fail Only</option>
              <option value="UPCOMING_DEADLINE">Upcoming Deadlines</option>
              <option value="INSUFFICIENT_DATA">Missing Data</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSortByRisk(!sortByRisk)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              sortByRisk
                ? 'border-brand bg-brand-light text-brand'
                : 'border-line bg-panel text-muted hover:text-ink'
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>{sortByRisk ? 'Sorted: Highest Risk First' : 'Sorted: Alphabetical'}</span>
          </button>
        </div>

        {/* Density switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-0.5">
          {(['compact', 'normal', 'comfortable'] as Density[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold capitalize transition-colors ${
                density === d ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-ink'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Matrix Grid with Sticky Headers */}
      <div
        ref={tableContainerRef}
        className="relative overflow-auto rounded-xl border border-line bg-panel max-h-[580px] shadow-inner"
      >
        <table className="w-full border-collapse text-left text-xs">
          {/* Sticky Column Headers (Rule Keys) */}
          <thead className="sticky top-0 z-30 bg-panel-header shadow-2xs border-b border-line">
            <tr>
              <th className="sticky left-0 z-40 bg-panel-header px-4 py-3 font-bold text-ink min-w-[14rem] border-r border-line">
                Regulated Entity Profile
              </th>
              {visibleRules.map((r) => (
                <th
                  key={r.id}
                  className={`px-3 py-3 font-mono font-semibold text-muted text-center border-r border-line last:border-r-0 ${
                    density === 'compact' ? 'w-10 min-w-10' : density === 'normal' ? 'w-24 min-w-24' : 'w-36 min-w-36'
                  }`}
                  title={`${r.ruleKey} (v${r.ruleVersion}) - ${ruleSummary(r.definitionJson)}`}
                >
                  <span className="block truncate text-[11px] text-ink">{r.ruleKey}</span>
                  <span className="block text-[9px] uppercase tracking-wider text-brand font-sans">
                    {r.type}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Matrix Rows */}
          <tbody className="divide-y divide-line">
            {visibleProfiles.map((p) => {
              const riskScore = entityRiskScores.get(p.id) ?? 0

              return (
                <tr key={p.id} className="hover:bg-surface/40 transition-colors">
                  {/* Sticky Row Header (Entity Name) */}
                  <th className="sticky left-0 z-20 bg-panel px-4 py-3 border-r border-line shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block font-bold text-ink truncate">{p.name}</span>
                        <span className="block text-[10px] text-muted truncate">{p.category.name}</span>
                      </div>
                      {riskScore > 0 && (
                        <span className="shrink-0 rounded-full bg-upcoming-bg border border-upcoming-border px-1.5 py-0.5 text-[9px] font-bold text-upcoming">
                          Risk {riskScore}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* Matrix Cells */}
                  {visibleRules.map((r) => {
                    const ev = evalMap.get(`${r.ruleKey}|${p.id}`)
                    const res = ev?.result

                    if (statusFilter !== 'all' && res !== statusFilter) {
                      return (
                        <td key={r.id} className="p-1 border-r border-line text-center text-muted/30">
                          ·
                        </td>
                      )
                    }

                    if (!res) {
                      return (
                        <td
                          key={r.id}
                          className="p-1 border-r border-line text-center text-muted/40"
                          title="Not evaluated yet"
                        >
                          <Minus className="h-3 w-3 mx-auto" />
                        </td>
                      )
                    }

                    const style = CELL_STYLE[res]
                    const Icon = CELL_ICON[res]

                    return (
                      <td key={r.id} className="p-1 border-r border-line text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCell({
                              entityId: p.id,
                              entityName: p.name,
                              entityCategory: p.category.name,
                              ruleKey: r.ruleKey,
                              ruleType: r.type,
                              ruleVersion: r.ruleVersion,
                              ruleSummaryText: ruleSummary(r.definitionJson),
                              evaluationId: ev?.id,
                              result: res,
                              explanation: ev?.detailsJson?.explanation,
                              inputsUsed: ev?.inputRef,
                              evaluatedAt: ev?.evaluatedAt,
                            })
                          }
                          title={`${p.name} · ${r.ruleKey}: ${style.label} - Click to drill down`}
                          className={`w-full rounded-md py-1.5 px-1 border transition-all duration-150 inline-flex items-center justify-center gap-1 ${style.bg} ${style.border} ${style.text} hover:scale-105 hover:shadow-xs`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {density !== 'compact' && (
                            <span className="text-[10px] font-bold leading-none">
                              {density === 'normal' ? style.label.slice(0, 4) : style.label}
                            </span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Drill-down slideover drawer */}
      <HeatmapDrawer selected={selectedCell} onClose={() => setSelectedCell(null)} />
    </div>
  )
}
