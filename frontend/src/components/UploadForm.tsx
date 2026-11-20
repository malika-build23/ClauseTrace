import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ApiError, apiUpload, type UploadResult } from '../lib/api'

const MAX_BYTES = 10 * 1024 * 1024

type Phase =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number }
  | { kind: 'parsing'; slow: boolean }
  | { kind: 'error'; message: string; documentId?: string }

type Props = {
  /** Set to upload a new version of an existing document. */
  documentId?: string
  onDone: (result: UploadResult) => void
  compact?: boolean
}

export function UploadForm({ documentId, onDone, compact = false }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = phase.kind === 'uploading' || phase.kind === 'parsing'

  function pick(f: File | undefined) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setPhase({ kind: 'error', message: 'Only PDF files can be uploaded.' })
      return
    }
    if (f.size > MAX_BYTES) {
      setPhase({ kind: 'error', message: 'The PDF is larger than 10 MB.' })
      return
    }
    setFile(f)
    setPhase({ kind: 'idle' })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (!busy) pick(e.dataTransfer.files[0])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file || busy) return
    const form = new FormData()
    form.append('file', file)
    if (documentId) form.append('documentId', documentId)
    else if (title.trim()) form.append('title', title.trim())

    setPhase({ kind: 'uploading', progress: 0 })
    let slowTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await apiUpload<UploadResult>('/api/documents', form, (progress) => {
        if (progress < 1) {
          setPhase({ kind: 'uploading', progress })
        } else {
          setPhase({ kind: 'parsing', slow: false })
          slowTimer = setTimeout(() => setPhase({ kind: 'parsing', slow: true }), 8000)
        }
      })
      setFile(null)
      setTitle('')
      setPhase({ kind: 'idle' })
      onDone(result)
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      const docId = typeof apiErr?.body.documentId === 'string' ? apiErr.body.documentId : undefined
      setPhase({ kind: 'error', message: (err as Error).message, documentId: docId })
    } finally {
      clearTimeout(slowTimer)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose a PDF to upload"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          compact ? 'px-4 py-5' : 'px-6 py-10'
        } ${dragging ? 'border-brand bg-blue-50' : 'border-line bg-surface hover:border-slate-400'} ${busy ? 'cursor-wait opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
          disabled={busy}
        />
        {file ? (
          <>
            <p className="font-medium break-all">{file.name}</p>
            <p className="text-sm text-muted">{(file.size / 1024).toFixed(0)} KB · click to choose another file</p>
          </>
        ) : (
          <>
            <p className="font-medium">{documentId ? 'Drop the amended PDF here' : 'Drop a regulatory PDF here'}</p>
            <p className="text-sm text-muted">or click to browse · PDF only, up to 10 MB</p>
          </>
        )}
      </div>

      {!documentId && (
        <label className="block">
          <span className="text-sm font-medium">Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the file name"
            maxLength={300}
            disabled={busy}
            className="mt-1 block w-full rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
          />
        </label>
      )}

      <div aria-live="polite" className="space-y-2">
        {phase.kind === 'uploading' && (
          <div>
            <div className="mb-1 flex justify-between text-sm text-muted">
              <span>Uploading…</span>
              <span>{Math.round(phase.progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${phase.progress * 100}%` }} />
            </div>
          </div>
        )}
        {phase.kind === 'parsing' && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden />
            {phase.slow
              ? 'Still parsing… the AI service may be waking up on free hosting (up to a minute).'
              : 'Uploaded. Splitting the document into clauses…'}
          </p>
        )}
        {phase.kind === 'error' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-fail">
            {phase.message}
            {phase.documentId && (
              <>
                {' '}
                <a className="font-medium underline" href={`/documents/${phase.documentId}`}>
                  Open the document
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!file || busy}
        className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Working…' : documentId ? 'Upload new version' : 'Upload and parse'}
      </button>
    </form>
  )
}
