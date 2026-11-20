import type { EvaluationRow } from '../lib/api'
import { ruleSummary } from '../lib/rules'
import { ResultBadge } from './ResultBadge'

/** Baseline (real profile) vs scenario (simulation) for the same rules. */
export function SimulationComparison({ baseline, scenario }: { baseline: EvaluationRow[]; scenario: EvaluationRow[] }) {
  const keys = [...new Set([...baseline, ...scenario].map((e) => e.rule.ruleKey))].sort()
  const find = (rows: EvaluationRow[], key: string) => rows.find((e) => e.rule.ruleKey === key)
  return (
    <section className="rounded-xl border border-purple-200 bg-panel p-5 shadow-sm">
      <h2 className="font-medium">
        <span className="mr-2 rounded bg-purple-50 px-1.5 py-0.5 text-xs font-semibold text-simulation">SIMULATION</span>
        Baseline vs scenario
      </h2>
      <p className="mt-1 text-sm text-muted">Latest result of each rule for the original profile and for this what-if copy.</p>
      {keys.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Evaluate the simulation to compare.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="py-2 pr-3 font-medium">Rule</th>
                <th className="py-2 pr-3 font-medium">Baseline</th>
                <th className="py-2 font-medium">Scenario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => {
                const b = find(baseline, k)
                const s = find(scenario, k)
                const changed = b && s && b.result !== s.result
                return (
                  <tr key={k} className={changed ? 'bg-purple-50/50' : ''}>
                    <td className="py-2 pr-3 font-mono text-xs">{ruleSummary((s ?? b)!.rule.definitionJson)}</td>
                    <td className="py-2 pr-3">{b ? <ResultBadge result={b.result} /> : <span className="text-xs text-muted">not evaluated</span>}</td>
                    <td className="py-2">
                      {s ? <ResultBadge result={s.result} /> : <span className="text-xs text-muted">not evaluated</span>}
                      {changed && <span className="ml-2 text-xs font-medium text-simulation">changed</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
