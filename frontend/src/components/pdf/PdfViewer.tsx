import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { AlertCircle, Eye, ExternalLink, Loader2 } from 'lucide-react'
import { apiGetBlob, type Obligation } from '../../lib/api'
import { findQuoteInTextItems, type HighlightBox, type PdfTextItem } from '../../lib/pdfHighlight'
import { PdfControls, type PdfFilterState } from './PdfControls'
import { PdfLegend } from './PdfLegend'
import { ModalityBadge } from '../ui/ModalityBadge'
import { StatusBadge } from '../ui/StatusBadge'

// Configure worker using Vite worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfViewerProps {
  documentId: string
  versionNo: number
  initialPage?: number
  obligations?: Obligation[]
  activeObligationId?: string
  onObligationSelect?: (obId: string) => void
  className?: string
}

interface HighlightWithMeta {
  box: HighlightBox
  obligation: Obligation
}

interface UnmatchedQuoteNotice {
  obligationId: string
  key: string
  quote: string
  reason: string
}

export function PdfViewer({
  documentId,
  versionNo,
  initialPage = 1,
  obligations = [],
  activeObligationId,
  onObligationSelect,
  className = '',
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [zoom, setZoom] = useState<number>(1.1)
  const [loading, setLoading] = useState<boolean>(true)
  const [rendering, setRendering] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<PdfFilterState>({
    status: 'all',
    modality: 'all',
    ambiguousOnly: false,
  })

  const [highlights, setHighlights] = useState<HighlightWithMeta[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedQuoteNotice[]>([])
  const [hoveredOb, setHoveredOb] = useState<{ ob: Obligation; x: number; y: number } | null>(null)

  // Sync initialPage or external navigation
  useEffect(() => {
    if (initialPage && initialPage >= 1 && initialPage !== currentPage) {
      setCurrentPage(initialPage)
    }
  }, [initialPage, currentPage])

  // Load PDF Document bytes
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    const fetchUrl = `/api/documents/${documentId}/versions/${versionNo}/file`
    apiGetBlob(fetchUrl)
      .then(async (blob) => {
        if (!active) return
        const arrayBuffer = await blob.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const doc = await loadingTask.promise
        if (!active) return
        setPdfDoc(doc)
        setTotalPages(doc.numPages)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (!active) return
        setError(`Failed to load document: ${err.message}`)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [documentId, versionNo])

  // Render Page to Canvas and Compute Highlights
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return
    setRendering(true)

    try {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise

      // Text content extraction for live highlights
      const textContent = await page.getTextContent()
      const textItems = textContent.items as unknown as PdfTextItem[]

      // Filter obligations relevant to this page
      const pageObligations = obligations.filter((ob) => {
        if (ob.clause.page !== currentPage) return false
        if (filter.status !== 'all' && ob.status !== filter.status) return false
        if (filter.modality !== 'all' && ob.modality !== filter.modality) return false
        if (filter.ambiguousOnly && !ob.ambiguityFlag) return false
        return true
      })

      const foundHighlights: HighlightWithMeta[] = []
      const missingQuotes: UnmatchedQuoteNotice[] = []

      for (const ob of pageObligations) {
        if (!ob.quote) continue

        const match = findQuoteInTextItems(
          textItems,
          ob.quote,
          (x, y) => {
            const pt = viewport.convertToViewportPoint(x, y)
            return [Number(pt[0]), Number(pt[1])]
          },
        )

        if (match.matched && match.rects.length > 0) {
          match.rects.forEach((box) => {
            foundHighlights.push({ box, obligation: ob })
          })
        } else {
          missingQuotes.push({
            obligationId: ob.id,
            key: ob.obligationKey,
            quote: ob.quote,
            reason: match.reason ?? 'Text layer coordinates not detected',
          })
        }
      }

      setHighlights(foundHighlights)
      setUnmatched(missingQuotes)
    } catch (err) {
      setError(`Page render error: ${(err as Error).message}`)
    } finally {
      setRendering(false)
    }
  }, [pdfDoc, currentPage, zoom, obligations, filter])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // Scroll to active obligation if requested
  useEffect(() => {
    if (activeObligationId) {
      const targetOb = obligations.find((o) => o.id === activeObligationId)
      if (targetOb && targetOb.clause.page !== currentPage) {
        setCurrentPage(targetOb.clause.page)
      }
    }
  }, [activeObligationId, obligations, currentPage])

  // Modality styles for live highlights
  const getModalityHighlightClass = (modality: string) => {
    switch (modality) {
      case 'must':
        return 'bg-[#116466]/25 border-[#116466]'
      case 'must_not':
        return 'bg-[#b91c1c]/25 border-[#b91c1c]'
      case 'should':
        return 'bg-[#b45309]/25 border-[#b45309]'
      case 'may':
        return 'bg-[#0369a1]/25 border-[#0369a1]'
      default:
        return 'bg-brand/20 border-brand'
    }
  }

  const getStatusBorderClass = (status: string) => {
    switch (status) {
      case 'approved':
      case 'edited':
        return 'border-solid border-2'
      case 'rejected':
        return 'border-dotted border-2 line-through opacity-60'
      case 'proposed':
      default:
        return 'border-dashed border-2'
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm ${className}`}>
      {/* Controls & Legend */}
      <PdfControls
        page={currentPage}
        totalPages={totalPages}
        onPageChange={(p) => setCurrentPage(Math.max(1, Math.min(totalPages, p)))}
        zoom={zoom}
        onZoomChange={setZoom}
        filter={filter}
        onFilterChange={setFilter}
      />

      <PdfLegend />

      {/* Unmatched Quotes Warning Banner (Strict Guarantee: Never Guess Positions) */}
      {unmatched.length > 0 && (
        <aside
          aria-label="Highlight notice"
          className="rounded-xl border border-upcoming-border bg-upcoming-bg px-4 py-2.5 text-xs text-upcoming flex items-start gap-2 shadow-2xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {unmatched.length} verified quote{unmatched.length === 1 ? '' : 's'} on page {currentPage} could not be
              positioned in the digital text layer:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted">
              {unmatched.map((u) => (
                <li key={u.obligationId}>
                  <span className="font-mono font-medium text-ink">{u.key}</span>: “{u.quote}” (
                  {u.reason})
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}

      {/* Main PDF Canvas Viewport Container */}
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-xl border border-line bg-zinc-800/10 dark:bg-black/40 min-h-[500px] flex justify-center items-start p-4 shadow-inner"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-panel/75 backdrop-blur-xs z-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="mt-2 text-xs font-semibold text-ink">Loading PDF Document…</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center text-fail text-sm">
            <p className="font-semibold">Unable to display PDF</p>
            <p className="mt-1 text-xs text-muted">{error}</p>
          </div>
        )}

        <div className="relative inline-block shadow-xl rounded-sm overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block max-w-full h-auto" />

          {/* Interactive Live Highlight Overlay */}
          {!loading && !rendering && (
            <div className="absolute inset-0 pointer-events-none" aria-label="PDF Highlights Overlay">
              {highlights.map((h, idx) => {
                const isSelected = activeObligationId === h.obligation.id
                const modCls = getModalityHighlightClass(h.obligation.modality)
                const statusCls = getStatusBorderClass(h.obligation.status)

                return (
                  <div
                    key={`${h.obligation.id}-${idx}`}
                    onClick={() => onObligationSelect?.(h.obligation.id)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredOb({ ob: h.obligation, x: rect.left, y: rect.top - 10 })
                    }}
                    onMouseLeave={() => setHoveredOb(null)}
                    style={{
                      left: `${h.box.x}px`,
                      top: `${h.box.y}px`,
                      width: `${h.box.width}px`,
                      height: `${h.box.height}px`,
                    }}
                    className={`absolute pointer-events-auto cursor-pointer rounded-xs transition-all duration-150 ${modCls} ${statusCls} ${
                      isSelected
                        ? 'ring-4 ring-brand ring-offset-1 animate-pulse shadow-lg z-20'
                        : 'hover:brightness-95 hover:shadow-xs z-10'
                    }`}
                    title={`Click to view obligation ${h.obligation.obligationKey}`}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Obligation Hover Card */}
      {hoveredOb && (
        <aside
          role="region"
          aria-label="Obligation Preview"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 320, Math.max(16, hoveredOb.x))}px`,
            top: `${Math.max(16, hoveredOb.y - 120)}px`,
            zIndex: 60,
          }}
          className="w-80 rounded-xl border border-line bg-panel p-3.5 shadow-2xl space-y-2 pointer-events-none animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ModalityBadge modality={hoveredOb.ob.modality} />
              <span className="font-mono text-xs font-bold text-brand">{hoveredOb.ob.obligationKey}</span>
            </div>
            <StatusBadge status={hoveredOb.ob.status} />
          </div>

          <p className="text-xs text-ink leading-snug">
            <span className="font-semibold">{hoveredOb.ob.subject}</span> — {hoveredOb.ob.action}
          </p>

          {hoveredOb.ob.thresholdJson && (
            <p className="font-mono text-[11px] text-brand bg-surface p-1.5 rounded border border-line">
              Threshold: {hoveredOb.ob.thresholdJson.metric} {hoveredOb.ob.thresholdJson.operator}{' '}
              {hoveredOb.ob.thresholdJson.value} {hoveredOb.ob.thresholdJson.unit ?? ''}
            </p>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-line text-[10px] text-muted">
            <span>Clause {hoveredOb.ob.clause.clauseNumber}</span>
            <span className="flex items-center gap-1 text-brand font-medium">
              Click highlight to select <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </aside>
      )}

      {/* Bottom Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted px-1">
        <span className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-brand" />
          <span>
            {highlights.length} highlight{highlights.length === 1 ? '' : 's'} visible on page {currentPage}
          </span>
        </span>
        <span className="text-[11px]">
          Click any highlight in the PDF to inspect or edit the obligation record.
        </span>
      </div>
    </div>
  )
}
