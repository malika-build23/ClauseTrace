import { Link } from 'react-router'
import { AlertTriangle, Eye, ShieldCheck, UserCheck } from 'lucide-react'
import { ResultBadge } from '../ui/ResultBadge'
import { ruleSummary } from '../../lib/rules'
import type { EvaluationRow, RuleRow } from '../../lib/api'

export interface TraceListFallbackProps {
  evaluation: EvaluationRow
  ruleHistory: RuleRow | null
  onOpenPdf: (documentId: string, versionNo: number, page: number, quote: string) => void
}

export function TraceListFallback({ evaluation, ruleHistory, onOpenPdf }: TraceListFallbackProps) {
  const ev = evaluation
  const d = ev.detailsJson
  const r = ruleHistory

  const stepClass = 'rounded-xl border border-line bg-panel p-5 shadow-sm transition-colors'
  const missingClass = 'rounded-xl border border-red-300 bg-red-50/60 p-5 shadow-sm dark:border-red-900 dark:bg-red-950/30'

  const reviewer = d?.obligation?.approvedBy ?? r?.createdBy?.name
  const quote = d?.obligation?.quote ?? r?.obligation?.quote
  const docId = d?.source?.documentId ?? r?.obligation?.clause?.documentVersion?.document?.id
  const docVer = d?.source?.documentVersion ?? r?.obligation?.clause?.documentVersion?.versionNo ?? 1
  const pageNo = d?.source?.page ?? r?.obligation?.clause?.page

  return (
    <ol className="space-y-4" aria-label="Step-by-step Traceability Lineage">
      {/* 1. Result */}
      <li className={stepClass}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">1 · Result Determination</p>
          <ResultBadge result={ev.result} />
        </div>
        <p className="mt-2 text-sm leading-relaxed">{d.explanation}</p>
        <p className="mt-3 text-xs font-semibold text-muted uppercase">
          Inputs used (captured at evaluation time):
        </p>
        <pre className="mt-1 overflow-x-auto rounded border border-line bg-surface p-2.5 font-mono text-xs">
          {JSON.stringify(ev.inputRef, null, 2)}
        </pre>
      </li>

      {/* 2. Deterministic Rule */}
      <li className={ev.rule ? stepClass : missingClass}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" />
            2 · Compiled Rule (Deterministic, No AI)
          </p>
          <span className="text-xs text-muted">
            {ev.rule?.isActive ? 'Active version' : 'Superseded'}
          </span>
        </div>
        {ev.rule ? (
          <>
            <p className="mt-2 font-mono text-sm text-ink">{ruleSummary(ev.rule.definitionJson)}</p>
            <p className="mt-1.5 text-xs text-muted">
              <Link to={`/rules?key=${encodeURIComponent(ev.rule.ruleKey)}&all=true`} className="text-brand hover:underline font-mono">
                {ev.rule.ruleKey} version {ev.ruleVersion}
              </Link>
              {r && <> · compiled by {r.createdBy.name} on {new Date(r.createdAt).toLocaleString()}</>}
            </p>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>Missing Rule: Compiled rule definition could not be retrieved from database.</span>
          </div>
        )}
      </li>

      {/* 3. Approved Obligation */}
      <li className={d.obligation ? stepClass : missingClass}>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">3 · Approved Obligation</p>
        {d.obligation ? (
          <>
            <p className="mt-2 text-sm">
              <Link to={r ? `/obligations/${r.obligation.id}` : '#'} className="font-mono text-brand hover:underline font-medium">
                {d.obligation.key}
              </Link>{' '}
              version {d.obligation.version}
            </p>
            {r && (
              <p className="mt-1 text-sm text-ink">
                <span className="font-medium">{r.obligation.subject}</span> — {r.obligation.action}
              </p>
            )}
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>Missing Obligation: Obligation record is not linked.</span>
          </div>
        )}
      </li>

      {/* 4. Human Reviewer */}
      <li className={reviewer ? stepClass : missingClass}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-teal" />
            4 · Human Reviewer Verification
          </p>
        </div>
        {reviewer ? (
          <p className="mt-2 text-sm text-ink">
            Approved by <strong className="font-medium">{reviewer}</strong>
            <span className="text-xs text-muted block mt-0.5">
              Approved by a human reviewer before it could become a rule.
            </span>
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>Principle 1 Notice: No human approval record found. Obligation has not completed reviewer sign-off.</span>
          </div>
        )}
      </li>

      {/* 5. Verbatim Quote */}
      <li className={quote ? stepClass : missingClass}>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">5 · Verbatim Source Quote</p>
        {quote ? (
          <blockquote className="mt-2 rounded border-l-4 border-amber-400 bg-amber-50/80 p-3 text-sm italic text-ink dark:border-amber-600 dark:bg-amber-950/30">
            “{quote}”
          </blockquote>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>Missing Quote: No verbatim quote stored in database.</span>
          </div>
        )}
      </li>

      {/* 6. Document Version */}
      <li className={stepClass}>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">6 · Document Authority</p>
        <p className="mt-2 text-sm">
          <Link to={`/documents/${d.source.documentId}?version=${d.source.documentVersion}`} className="text-brand hover:underline font-medium">
            {d.source.document}
          </Link>{' '}
          <span className="text-muted">· Version {d.source.documentVersion}</span>
        </p>
      </li>

      {/* 7. Clause & PDF Page */}
      <li className={stepClass}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">7 · Clause & PDF Location</p>
          {docId && pageNo && quote && (
            <button
              type="button"
              onClick={() => onOpenPdf(docId, docVer, pageNo, quote)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <Eye className="h-3.5 w-3.5" />
              Inspect on PDF Page {pageNo}
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-ink">
          Clause <span className="font-medium">{d.source.clause}</span> · Page <span className="font-medium">{d.source.page}</span>
        </p>
      </li>
    </ol>
  )
}
