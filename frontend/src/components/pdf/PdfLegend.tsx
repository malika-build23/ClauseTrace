import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export function PdfLegend({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border border-line bg-panel p-2.5 text-xs shadow-2xs ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-muted hover:text-ink font-medium"
      >
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <Info className="h-3.5 w-3.5 text-brand" />
          <span>Live Highlight Legend</span>
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-line text-[11px]">
          <div>
            <p className="font-semibold text-ink mb-1">Fill Colour by Modality:</p>
            <ul className="space-y-1 text-muted">
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs bg-[#116466]/25 border border-[#116466]" />
                <span className="font-bold text-[#116466]">MUST</span> — Mandatory duty
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs bg-[#b91c1c]/25 border border-[#b91c1c]" />
                <span className="font-bold text-[#b91c1c]">MUST NOT</span> — Strict prohibition
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs bg-[#b45309]/25 border border-[#b45309]" />
                <span className="font-bold text-[#b45309]">SHOULD</span> — Advisory requirement
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs bg-[#0369a1]/25 border border-[#0369a1]" />
                <span className="font-bold text-[#0369a1]">MAY</span> — Permissive guidance
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ink mb-1">Outline Style by Status:</p>
            <ul className="space-y-1 text-muted">
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs border-2 border-dashed border-muted bg-surface" />
                <span className="font-semibold text-ink">Proposed</span> — Unreviewed AI draft
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs border-2 border-solid border-pass bg-pass-bg" />
                <span className="font-semibold text-pass">Approved</span> — Enforceable verified rule
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-3 w-4 rounded-xs border-2 border-dotted border-fail bg-fail-bg line-through" />
                <span className="font-semibold text-fail">Rejected</span> — Excluded by compliance
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
