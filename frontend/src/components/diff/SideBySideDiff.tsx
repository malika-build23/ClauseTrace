import { useState } from 'react'
import { Columns2, AlignLeft } from 'lucide-react'
import { wordDiff } from '../../lib/diff'

export interface SideBySideDiffProps {
  oldText: string | null
  newText: string | null
  fromVersionNo?: number | null
  toVersionNo?: number | null
  changeType?: 'added' | 'removed' | 'modified'
  isMoved?: boolean
}

export function SideBySideDiff({
  oldText,
  newText,
  fromVersionNo,
  toVersionNo,
  changeType = 'modified',
  isMoved = false,
}: SideBySideDiffProps) {
  const [mode, setMode] = useState<'split' | 'inline'>('split')

  if (changeType === 'added') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm leading-relaxed text-pass dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="mb-2 text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">
          Entire Clause Added in Version {toVersionNo ?? '?'}
        </div>
        <p className="font-mono text-xs">{newText}</p>
      </div>
    )
  }

  if (changeType === 'removed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/60 p-4 text-sm leading-relaxed text-fail dark:border-red-900 dark:bg-red-950/30">
        <div className="mb-2 text-xs font-semibold uppercase text-red-800 dark:text-red-300">
          Clause Repealed / Removed from Version {fromVersionNo ?? '?'}
        </div>
        <p className="font-mono text-xs line-through decoration-red-400">{oldText}</p>
      </div>
    )
  }

  if (isMoved) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm leading-relaxed text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <div className="mb-2 text-xs font-semibold uppercase text-sky-800 dark:text-sky-300">
          Renumbered / Moved Clause (Text Unchanged)
        </div>
        <p className="font-mono text-xs">{newText || oldText}</p>
      </div>
    )
  }

  const segments = wordDiff(oldText ?? '', newText ?? '')

  return (
    <div className="space-y-2">
      {/* View Toggle */}
      <div className="flex items-center justify-end gap-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('split')}
          className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
            mode === 'split'
              ? 'bg-panel font-semibold text-teal shadow-xs border border-line'
              : 'text-muted hover:text-ink'
          }`}
          title="Side-by-side clause diff"
        >
          <Columns2 className="h-3.5 w-3.5" />
          Side-by-Side
        </button>
        <button
          type="button"
          onClick={() => setMode('inline')}
          className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
            mode === 'inline'
              ? 'bg-panel font-semibold text-teal shadow-xs border border-line'
              : 'text-muted hover:text-ink'
          }`}
          title="Inline unified diff"
        >
          <AlignLeft className="h-3.5 w-3.5" />
          Inline Diff
        </button>
      </div>

      {mode === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left: Previous Version */}
          <div className="rounded-lg border border-line bg-surface p-3.5">
            <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-xs">
              <span className="font-semibold text-muted uppercase">
                Original (Version {fromVersionNo ?? 'Base'})
              </span>
              <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-medium text-red-800">
                Deletions Strikethrough
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink font-mono text-xs">
              {segments.map((s, i) =>
                s.op === 'delete' ? (
                  <del
                    key={i}
                    className="rounded bg-red-100 text-fail decoration-red-500 font-semibold px-0.5 dark:bg-red-950 dark:text-red-300"
                    title="Removed word"
                  >
                    {s.text}{' '}
                  </del>
                ) : s.op === 'equal' ? (
                  <span key={i} className="text-ink">
                    {s.text}{' '}
                  </span>
                ) : null,
              )}
            </p>
          </div>

          {/* Right: Amended Version */}
          <div className="rounded-lg border border-line bg-panel p-3.5">
            <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-xs">
              <span className="font-semibold text-teal uppercase">
                Amended (Version {toVersionNo ?? 'New'})
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-medium text-emerald-800">
                Additions Highlighted
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink font-mono text-xs">
              {segments.map((s, i) =>
                s.op === 'insert' ? (
                  <ins
                    key={i}
                    className="rounded bg-emerald-100 text-pass no-underline font-semibold px-0.5 dark:bg-emerald-950 dark:text-emerald-300"
                    title="Added word"
                  >
                    {s.text}{' '}
                  </ins>
                ) : s.op === 'equal' ? (
                  <span key={i} className="text-ink">
                    {s.text}{' '}
                  </span>
                ) : null,
              )}
            </p>
          </div>
        </div>
      ) : (
        /* Inline Unified Diff */
        <div className="rounded-lg border border-line bg-surface p-3.5 text-xs font-mono leading-relaxed text-ink">
          {segments.map((s, i) =>
            s.op === 'equal' ? (
              <span key={i}>{s.text} </span>
            ) : s.op === 'delete' ? (
              <del
                key={i}
                className="rounded bg-red-100 text-fail decoration-red-500 px-0.5 font-medium dark:bg-red-950 dark:text-red-300"
                title="Removed"
              >
                {s.text}{' '}
              </del>
            ) : (
              <ins
                key={i}
                className="rounded bg-emerald-100 text-pass no-underline px-0.5 font-medium dark:bg-emerald-950 dark:text-emerald-300"
                title="Added"
              >
                {s.text}{' '}
              </ins>
            ),
          )}
        </div>
      )}
    </div>
  )
}
