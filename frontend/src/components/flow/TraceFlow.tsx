import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Eye, ShieldCheck, UserCheck } from 'lucide-react'
import { TraceNode } from './TraceNode'
import { ResultBadge } from '../ui/ResultBadge'
import { ruleSummary } from '../../lib/rules'
import type { EvaluationRow, RuleRow } from '../../lib/api'

const nodeTypes: NodeTypes = {
  traceNode: TraceNode,
}

export interface TraceFlowProps {
  evaluation: EvaluationRow
  ruleHistory: RuleRow | null
  onOpenPdf: (documentId: string, versionNo: number, page: number, quote: string) => void
}

export function TraceFlow({ evaluation, ruleHistory, onOpenPdf }: TraceFlowProps) {
  const ev = evaluation
  const d = ev.detailsJson
  const r = ruleHistory

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = []
    const edgeList: Edge[] = []

    const spacingY = 220
    const startX = 250

    // ─── 1. Result Node ────────────────────────────────────────────────────────
    nodeList.push({
      id: 'node-1-result',
      type: 'traceNode',
      position: { x: startX, y: 0 },
      data: {
        stage: 1,
        stageLabel: 'Deterministic Determination',
        title: `Compliance Result: ${ev.result}`,
        subtitle: `${ev.profile.name} · Evaluated ${new Date(ev.evaluatedAt).toLocaleDateString()}`,
        badge: (
          <div className="flex items-center gap-1.5">
            <ResultBadge result={ev.result} />
            {ev.isSimulation && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                SIM
              </span>
            )}
          </div>
        ),
        details: (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted font-sans">{d.explanation}</p>
            <p className="text-[10px] font-semibold text-muted uppercase font-sans">
              Inputs Used (Snapshot at evaluation time):
            </p>
            <pre className="text-[11px] leading-tight text-ink">
              {JSON.stringify(ev.inputRef, null, 2)}
            </pre>
          </div>
        ),
      },
    })

    // ─── 2. Rule Version Node ──────────────────────────────────────────────────
    const hasRule = Boolean(ev.rule)
    nodeList.push({
      id: 'node-2-rule',
      type: 'traceNode',
      position: { x: startX, y: spacingY },
      data: {
        stage: 2,
        stageLabel: 'Compiled Deterministic Rule',
        title: ev.rule ? `${ev.rule.ruleKey} (v${ev.ruleVersion})` : 'Rule Not Found',
        subtitle: ev.rule
          ? `Engine: Deterministic (No AI) · ${ev.rule.isActive ? 'Active Version' : 'Superseded'}`
          : undefined,
        isMissing: !hasRule,
        missingReason: !hasRule ? 'Rule definition record is missing from database.' : undefined,
        badge: (
          <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal border border-teal-200">
            <ShieldCheck className="h-3 w-3" /> Rule AST
          </span>
        ),
        details: ev.rule ? (
          <div className="space-y-1">
            <p className="text-[11px] text-muted font-sans font-medium">Summary:</p>
            <p className="font-mono text-ink text-[11px]">{ruleSummary(ev.rule.definitionJson)}</p>
            {r && (
              <p className="text-[10px] text-muted font-sans pt-1">
                Compiled by {r.createdBy?.name ?? 'Admin'} on {new Date(r.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : undefined,
      },
    })

    // ─── 3. Approved Obligation Node ───────────────────────────────────────────
    const obKey = d?.obligation?.key ?? r?.obligation?.obligationKey
    const obVersion = d?.obligation?.version ?? r?.obligation?.version
    const hasObligation = Boolean(obKey)
    nodeList.push({
      id: 'node-3-obligation',
      type: 'traceNode',
      position: { x: startX, y: spacingY * 2 },
      data: {
        stage: 3,
        stageLabel: 'Approved Obligation Record',
        title: hasObligation ? `${obKey} (v${obVersion})` : 'Missing Obligation',
        subtitle: r?.obligation
          ? `${r.obligation.subject} — ${r.obligation.action}`
          : 'Extracted regulatory requirement',
        isMissing: !hasObligation,
        missingReason: !hasObligation ? 'Approved obligation not linked to this evaluation.' : undefined,
        details: (
          <div className="space-y-1 font-sans text-[11px]">
            <p>
              <strong className="text-muted">Subject:</strong> {r?.obligation?.subject ?? 'Entity'}
            </p>
            <p>
              <strong className="text-muted">Action:</strong> {r?.obligation?.action ?? 'Comply'}
            </p>
          </div>
        ),
      },
    })

    // ─── 4. Human Reviewer Node ────────────────────────────────────────────────
    const reviewerName = d?.obligation?.approvedBy ?? r?.createdBy?.name
    const hasReviewer = Boolean(reviewerName)
    nodeList.push({
      id: 'node-4-reviewer',
      type: 'traceNode',
      position: { x: startX, y: spacingY * 3 },
      data: {
        stage: 4,
        stageLabel: 'Human Reviewer Verification',
        title: hasReviewer ? `Approved by ${reviewerName}` : 'Unverified / No Human Reviewer',
        subtitle: hasReviewer ? 'Approved by a human reviewer' : 'Audit Notice',
        isMissing: !hasReviewer,
        missingReason: !hasReviewer
          ? 'Principle 1 Warning: This obligation does not have an approved human reviewer record. System rule requires human approval before regulatory finality.'
          : undefined,
        badge: (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
            <UserCheck className="h-3 w-3" /> Sign-off
          </span>
        ),
        details: (
          <p className="font-sans text-[11px] text-muted">
            Strict Principle: AI proposes, code verifies, humans approve.
          </p>
        ),
      },
    })

    // ─── 5. Verbatim Quote Node ────────────────────────────────────────────────
    const quoteText = d?.obligation?.quote ?? r?.obligation?.quote
    const hasQuote = Boolean(quoteText && quoteText.trim().length > 0)
    nodeList.push({
      id: 'node-5-quote',
      type: 'traceNode',
      position: { x: startX, y: spacingY * 4 },
      data: {
        stage: 5,
        stageLabel: 'Verbatim Regulatory Quote',
        title: 'Source Authority Text',
        subtitle: 'Word-for-word excerpt from published regulation',
        quote: quoteText,
        isMissing: !hasQuote,
        missingReason: !hasQuote ? 'Verbatim quote is missing from obligation record.' : undefined,
        details: (
          <p className="font-sans text-[11px] text-muted">
            Strict Principle: Never show a quote that is not word for word from the regulatory database.
          </p>
        ),
      },
    })

    // ─── 6. Document Version Node ──────────────────────────────────────────────
    const docTitle = d?.source?.document ?? r?.obligation?.clause?.documentVersion?.document?.title
    const docVer = d?.source?.documentVersion ?? r?.obligation?.clause?.documentVersion?.versionNo
    const docId = d?.source?.documentId ?? r?.obligation?.clause?.documentVersion?.document?.id
    const hasDoc = Boolean(docTitle && docVer)
    nodeList.push({
      id: 'node-6-document',
      type: 'traceNode',
      position: { x: startX, y: spacingY * 5 },
      data: {
        stage: 6,
        stageLabel: 'Document Version Authority',
        title: hasDoc ? `${docTitle} (v${docVer})` : 'Document Version Missing',
        subtitle: 'Official Gazetted Regulatory Instrument',
        isMissing: !hasDoc,
        missingReason: !hasDoc ? 'Document version reference is broken.' : undefined,
      },
    })

    // ─── 7. Clause & PDF Page Node ─────────────────────────────────────────────
    const clauseNo = d?.source?.clause ?? r?.obligation?.clause?.clauseNumber
    const pageNo = d?.source?.page ?? r?.obligation?.clause?.page
    const hasPage = Boolean(pageNo && pageNo > 0)
    nodeList.push({
      id: 'node-7-clause',
      type: 'traceNode',
      position: { x: startX, y: spacingY * 6 },
      data: {
        stage: 7,
        stageLabel: 'Clause & PDF Source Location',
        title: hasPage ? `Clause ${clauseNo} · Page ${pageNo}` : 'Clause / Page Unknown',
        subtitle: 'Original PDF Coordinate Anchor',
        isMissing: !hasPage,
        missingReason: !hasPage ? 'Page coordinates missing from clause record.' : undefined,
        actionButton:
          docId && pageNo && quoteText
            ? {
                label: `Inspect in Live PDF (Page ${pageNo})`,
                icon: <Eye className="h-3.5 w-3.5" />,
                onClick: () => onOpenPdf(docId, docVer ?? 1, pageNo, quoteText),
              }
            : undefined,
      },
    })

    // ─── Edges with Animated Pulsing Lineage ───────────────────────────────────
    for (let i = 0; i < nodeList.length - 1; i++) {
      const fromNode = nodeList[i]
      const toNode = nodeList[i + 1]
      const toMissing = Boolean((toNode.data as unknown as { isMissing?: boolean }).isMissing)

      edgeList.push({
        id: `edge-${fromNode.id}->${toNode.id}`,
        source: fromNode.id,
        target: toNode.id,
        animated: true,
        style: {
          stroke: toMissing ? 'var(--color-fail)' : 'var(--color-brand)',
          strokeWidth: 2.5,
          strokeDasharray: toMissing ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: toMissing ? 'var(--color-fail)' : 'var(--color-brand)',
        },
      })
    }

    return { nodes: nodeList, edges: edgeList }
  }, [ev, d, r, onOpenPdf])

  return (
    <div className="h-[750px] w-full rounded-xl border border-line bg-surface/50 shadow-inner relative overflow-hidden">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg bg-panel/90 px-3 py-1.5 text-xs text-muted backdrop-blur shadow-sm border border-line">
        <span className="inline-block h-2 w-2 rounded-full bg-teal animate-pulse" />
        Traceability Lineage: Deterministic Result &rarr; Regulatory PDF Source
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background color="var(--color-line)" gap={18} size={1} />
        <Controls className="!bg-panel !border-line !shadow-sm" />
      </ReactFlow>
    </div>
  )
}
