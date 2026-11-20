import { useState } from 'react'
import type { ReactNode } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react'

export interface TraceNodeData {
  stage: number
  stageLabel: string
  title: string
  subtitle?: string
  badge?: ReactNode
  isMissing?: boolean
  missingReason?: string
  details?: ReactNode
  quote?: string
  actionButton?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
}

export function TraceNode(props: NodeProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const nodeData = props.data as unknown as TraceNodeData

  const isMissing = Boolean(nodeData.isMissing)

  return (
    <div
      role="region"
      aria-label={`${nodeData.stageLabel}: ${nodeData.title}`}
      className={`w-80 rounded-xl border text-ink shadow-md transition-all duration-150 ${
        isMissing
          ? 'border-red-400 bg-red-50/80 dark:border-red-600 dark:bg-red-950/40 ring-2 ring-red-300 dark:ring-red-900'
          : 'border-line bg-panel hover:border-brand/60 dark:bg-panel'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !rounded-full !border-2 ${
          isMissing ? '!border-red-500 !bg-red-100' : '!border-teal !bg-surface'
        }`}
      />

      {/* Header bar with stage number */}
      <div
        className={`flex items-center justify-between border-b px-3.5 py-2 text-xs font-semibold uppercase tracking-wider ${
          isMissing
            ? 'border-red-200 bg-red-100/60 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300'
            : 'border-line bg-surface text-muted'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {isMissing ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <span className="font-mono">{nodeData.stage} ·</span>}
          {nodeData.stageLabel}
        </span>
        {nodeData.badge && <div>{nodeData.badge}</div>}
      </div>

      {/* Main Node Content */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-snug">{nodeData.title}</h3>
            {nodeData.subtitle && (
              <p className="mt-0.5 text-xs text-muted">{nodeData.subtitle}</p>
            )}
          </div>
        </div>

        {/* Missing provenance warning banner */}
        {isMissing && (
          <div className="rounded-lg border border-red-300 bg-red-100/80 p-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/80 dark:text-red-200">
            <p className="font-medium flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Provenance link broken / missing
            </p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {nodeData.missingReason ?? 'This provenance step cannot be verified from database records. Compliance determination requires audit.'}
            </p>
          </div>
        )}

        {/* Verbatim Quote Display */}
        {nodeData.quote && (
          <blockquote className="rounded border-l-4 border-amber-400 bg-amber-50/80 p-2 text-xs text-ink italic dark:border-amber-600 dark:bg-amber-950/30">
            “{nodeData.quote}”
          </blockquote>
        )}

        {/* Expandable Details Accordion */}
        {nodeData.details && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> View details
                </>
              )}
            </button>
            {expanded && (
              <div className="mt-2 rounded border border-line bg-surface p-2 text-xs text-ink font-mono overflow-x-auto">
                {nodeData.details}
              </div>
            )}
          </div>
        )}

        {/* Action Button (e.g. Jump to Live PDF) */}
        {nodeData.actionButton && (
          <div className="pt-1">
            <button
              type="button"
              onClick={nodeData.actionButton.onClick}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-hover transition-colors"
            >
              {nodeData.actionButton.icon ?? <FileText className="h-3.5 w-3.5" />}
              {nodeData.actionButton.label}
            </button>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !rounded-full !border-2 ${
          isMissing ? '!border-red-500 !bg-red-100' : '!border-teal !bg-surface'
        }`}
      />
    </div>
  )
}
