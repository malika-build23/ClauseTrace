// Empty in dev (Vite proxies /api); the Render URL in production.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const message = typeof body.error === 'string' ? body.error : `${res.status} ${res.statusText}`
  return new ApiError(message, res.status, body)
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) throw await toError(res)
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, init?: RequestInit): Promise<T> {
  return apiGet<T>(path, { ...init, method: 'POST' })
}

/**
 * Multipart upload with progress. fetch() cannot report upload progress,
 * so this uses XMLHttpRequest. onProgress receives 0..1 for the upload;
 * the promise resolves after the server has also finished parsing.
 */
export function apiUpload<T>(path: string, form: FormData, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as Record<string, unknown>
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T)
      else reject(new ApiError(typeof body.error === 'string' ? body.error : `Upload failed (${xhr.status})`, xhr.status, body))
    }
    xhr.onerror = () => reject(new ApiError('Network error: the server could not be reached', 0))
    xhr.send(form)
  })
}

export type Health = { status: string; db: string; dbTime?: string }

export type ParsingStatus = 'pending' | 'parsing' | 'parsed' | 'needs_manual_split' | 'failed'

export type DocumentVersion = {
  id: string
  versionNo: number
  fileName: string
  fileHash: string
  uploadedAt: string
  parsingStatus: ParsingStatus
  _count: { clauses: number }
}

export type DocumentSummary = {
  id: string
  title: string
  regulator: string
  createdAt: string
  versions: DocumentVersion[] // newest first
}

export type DocumentDetail = DocumentSummary & { publishDate: string | null; createdBy: { name: string } }

export type Clause = {
  id: string
  clauseNumber: string
  page: number
  text: string
  parentClauseId: string | null
  position: number
}

export type ClauseList = { versionNo: number; parsingStatus: ParsingStatus; clauses: Clause[] }

export type UploadResult = {
  documentId: string
  versionNo: number
  parsingStatus: ParsingStatus
  pageCount: number
  clauseCount: number
}

export const pdfUrl = (documentId: string, versionNo: number) =>
  `${API_URL}/api/documents/${documentId}/versions/${versionNo}/file`

export type Modality = 'must' | 'must_not' | 'may' | 'should'
export type ObligationStatus = 'proposed' | 'approved' | 'edited' | 'rejected'

export type Threshold = { metric: string; operator: string; value: number; unit: string | null }

export type Obligation = {
  id: string
  obligationKey: string
  version: number
  clauseId: string
  quote: string
  subject: string
  modality: Modality
  action: string
  condition: string | null
  thresholdJson: Threshold | null
  deadline: string | null
  evidence: string | null
  machineCheckable: boolean
  ambiguityFlag: boolean
  ambiguityReason: string | null
  referenceOnly: boolean
  confidence: number | null
  status: ObligationStatus
  extractionRunId: string | null
  createdAt: string
  clause: { clauseNumber: string; page: number }
}

export type ObligationList = { versionNo: number; obligations: Obligation[] }

export type ExtractionStatus = 'queued' | 'running' | 'completed' | 'failed'

export type ExtractionRun = {
  id: string
  status: ExtractionStatus
  totalClauses: number
  processedClauses: number
  skippedClauses: number
  cachedClauses: number
  obligationsCreated: number
  rejectedCount: number
  rejectionsJson: { clause: string; reason: string; quote?: string | null }[]
  models: string | null
  promptVersion: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export type ExtractionState = { versionNo: number; run: ExtractionRun | null }
