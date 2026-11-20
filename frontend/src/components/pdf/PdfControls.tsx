import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { Modality, ObligationStatus } from '../../lib/api'

export interface PdfFilterState {
  status: ObligationStatus | 'all'
  modality: Modality | 'all'
  ambiguousOnly: boolean
}

export function PdfControls({
  page,
  totalPages,
  onPageChange,
  zoom,
  onZoomChange,
  filter,
  onFilterChange,
  className = '',
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  zoom: number
  onZoomChange: (z: number) => void
  filter: PdfFilterState
  onFilterChange: (f: PdfFilterState) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-line bg-panel p-2.5 shadow-2xs text-xs ${className}`}>
      {/* Page Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-40 transition-colors"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-medium text-ink tabular-nums">
          Page {page} of {totalPages || 1}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-40 transition-colors"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 pl-2 border-l border-line">
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(0.6, zoom - 0.15))}
          className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="font-medium text-ink tabular-nums w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onZoomChange(Math.min(2.5, zoom + 0.15))}
          className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(1.0)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink transition-colors"
          title="Reset zoom to 100%"
          aria-label="Reset zoom"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Highlight Filters */}
      <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-line">
        <select
          value={filter.modality}
          onChange={(e) => onFilterChange({ ...filter, modality: e.target.value as Modality | 'all' })}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
          title="Filter by modality"
          aria-label="Filter by modality"
        >
          <option value="all">All Modalities</option>
          <option value="must">MUST</option>
          <option value="must_not">MUST NOT</option>
          <option value="should">SHOULD</option>
          <option value="may">MAY</option>
        </select>

        <select
          value={filter.status}
          onChange={(e) => onFilterChange({ ...filter, status: e.target.value as ObligationStatus | 'all' })}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
          title="Filter by status"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="edited">Edited</option>
          <option value="rejected">Rejected</option>
        </select>

        <label className="flex items-center gap-1.5 text-muted cursor-pointer font-medium">
          <input
            type="checkbox"
            checked={filter.ambiguousOnly}
            onChange={(e) => onFilterChange({ ...filter, ambiguousOnly: e.target.checked })}
            className="rounded border-line text-brand focus:ring-brand"
          />
          <span>Vague only</span>
        </label>
      </div>
    </div>
  )
}
