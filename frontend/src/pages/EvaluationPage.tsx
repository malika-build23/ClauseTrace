import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { GitBranch, ListOrdered, FileText } from 'lucide-react'
import { ResultBadge } from '../components/ui/ResultBadge'
import { Card } from '../components/ui/Card'
import { Drawer } from '../components/ui/Drawer'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { TraceFlow } from '../components/flow/TraceFlow'
import { TraceListFallback } from '../components/flow/TraceListFallback'
import { PdfViewer } from '../components/pdf/PdfViewer'
import { apiGet, type EvaluationRow, type Obligation, type RuleRow } from '../lib/api'

export function EvaluationPage() {
  const { id = '' } = useParams()
  const [ev, setEv] = useState<EvaluationRow | null>(null)
  const [rule, setRule] = useState<RuleRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'flow' | 'list'>('flow')

  // PDF Inspector Drawer state
  const [pdfDrawer, setPdfDrawer] = useState<{
    isOpen: boolean
    documentId: string
    versionNo: number
    page: number
    quote: string
  } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiGet<EvaluationRow>(`/api/evaluations/${id}`)
      .then(async (e) => {
        setEv(e)
        try {
          const history = await apiGet<RuleRow[]>(`/api/rules/history/${encodeURIComponent(e.rule.ruleKey)}`)
          setRule(history.find((r) => r.ruleVersion === e.ruleVersion) ?? null)
        } catch {
          // Rule history fetch error shouldn't crash the evaluation page
          setRule(null)
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleOpenPdf(documentId: string, versionNo: number, page: number, quote: string) {
    setPdfDrawer({
      isOpen: true,
      documentId,
      versionNo,
      page,
      quote,
    })
  }

  if (error) {
    return (
      <div className="py-6">
        <ErrorState
          title="Failed to load evaluation trace"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (loading || !ev) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  // Construct synthetic obligation object for live PDF highlighting
  const currentObligation: Obligation | undefined = ev.detailsJson?.obligation
    ? {
        id: rule?.obligation?.id ?? 'trace-ob',
        obligationKey: ev.detailsJson.obligation.key,
        version: ev.detailsJson.obligation.version,
        clauseId: ev.detailsJson.source.clause,
        quote: ev.detailsJson.obligation.quote,
        subject: rule?.obligation?.subject ?? 'Entity',
        modality: (rule?.obligation as unknown as { modality?: string })?.modality as unknown as Obligation['modality'] ?? 'MUST',
        action: rule?.obligation?.action ?? 'Comply',
        condition: null,
        thresholdJson: null,
        deadline: null,
        evidence: null,
        machineCheckable: true,
        ambiguityFlag: false,
        ambiguityReason: null,
        referenceOnly: false,
        confidence: 1,
        status: (ev.detailsJson.obligation.approvedBy ? 'approved' : 'proposed') as Obligation['status'],
        extractionRunId: null,
        createdAt: ev.evaluatedAt,
        clause: {
          clauseNumber: ev.detailsJson.source.clause,
          page: ev.detailsJson.source.page,
        },
      }
    : undefined

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-muted hover:text-ink transition-colors">
            ← Overview
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            Traceability Chain <ResultBadge result={ev.result} />
            {ev.isSimulation && (
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-simulation border border-purple-200">
                SIMULATION
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-ink">{ev.profile.name}</strong> · Evaluated as of{' '}
            {ev.evaluationDate.slice(0, 10)} · Run at {new Date(ev.evaluatedAt).toLocaleString()}
          </p>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('flow')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'flow'
                ? 'bg-panel text-teal shadow-xs font-semibold'
                : 'text-muted hover:text-ink'
            }`}
            aria-pressed={viewMode === 'flow'}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Lineage Flow
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-panel text-teal shadow-xs font-semibold'
                : 'text-muted hover:text-ink'
            }`}
            aria-pressed={viewMode === 'list'}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Accessible List
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'flow' ? (
        <TraceFlow
          evaluation={ev}
          ruleHistory={rule}
          onOpenPdf={handleOpenPdf}
        />
      ) : (
        <Card className="p-6">
          <TraceListFallback
            evaluation={ev}
            ruleHistory={rule}
            onOpenPdf={handleOpenPdf}
          />
        </Card>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-line text-sm">
        <Link to={`/audit?objectId=${ev.id}`} className="text-brand hover:underline flex items-center gap-1">
          <FileText className="h-4 w-4" />
          Audit log trail for this evaluation
        </Link>
        <p className="text-xs text-muted">
          Principle 2: Every result stays traceable to its source clause and PDF page.
        </p>
      </div>

      {/* PDF Inspection Drawer */}
      <Drawer
        isOpen={Boolean(pdfDrawer?.isOpen)}
        onClose={() => setPdfDrawer(null)}
        title="Regulatory Source PDF Inspector"
        description={
          pdfDrawer
            ? `Viewing Page ${pdfDrawer.page} with verbatim regulatory quote highlighted in context.`
            : undefined
        }
        width="max-w-4xl"
      >
        {pdfDrawer && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-semibold block mb-0.5">Anchored Verbatim Quote:</span>
              “{pdfDrawer.quote}”
            </div>

            <PdfViewer
              documentId={pdfDrawer.documentId}
              versionNo={pdfDrawer.versionNo}
              initialPage={pdfDrawer.page}
              obligations={currentObligation ? [currentObligation] : []}
              activeObligationId={currentObligation?.id}
              className="h-[650px]"
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}
