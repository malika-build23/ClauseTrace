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

// ─── Session token ────────────────────────────────────────────────────────
// The API is on another site (Render) than the frontend (Vercel), and browsers
// increasingly block third-party cookies, so the token is sent as a Bearer
// header. It lives in localStorage so a reload keeps you signed in; React
// escapes all rendered text, which limits the XSS exposure of that choice.

const TOKEN_KEY = 'clausetrace.token'
let token: string | null = readStoredToken()
let onUnauthorized: (() => void) | null = null

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return token
}

export function setToken(value: string | null): void {
  token = value
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable (private mode): the session lasts until reload
  }
}

/** Called by the auth provider: what to do when the API says the session is invalid. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const message = typeof body.error === 'string' ? body.error : `${res.status} ${res.statusText}`
  return new ApiError(message, res.status, body)
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: authHeaders(init?.headers) })
  if (res.status === 401 && token && !path.startsWith('/api/auth/login')) onUnauthorized?.()
  if (!res.ok) throw await toError(res)
  return res
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>
}

export async function apiSend<T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiSend<T>('POST', path, body)
}

/**
 * Open a stored PDF in a new tab. A plain link cannot carry the Bearer token,
 * so the file is fetched and shown from a blob URL. The tab is opened first,
 * inside the click, so pop-up blockers allow it.
 */
export async function openPdf(documentId: string, versionNo: number, page?: number): Promise<void> {
  const tab = window.open('', '_blank')
  try {
    const res = await apiFetch(`/api/documents/${documentId}/versions/${versionNo}/file`)
    const url = URL.createObjectURL(await res.blob())
    const target = page ? `${url}#page=${page}` : url
    if (tab) tab.location.href = target
    else window.location.href = target
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    tab?.close()
    throw err
  }
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
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as Record<string, unknown>
      if (xhr.status === 401 && token) onUnauthorized?.()
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

export type Role = 'admin' | 'reviewer' | 'viewer'

export type SessionUser = { id: string; name: string; email: string; role: Role }

export type LoginResult = { token: string; expiresIn: number; user: SessionUser }

export type ManagedUser = SessionUser & { isActive: boolean; lastLoginAt: string | null; createdAt: string }

const ROLE_LEVEL: Record<Role, number> = { viewer: 1, reviewer: 2, admin: 3 }

/** UI-side role check. The API enforces the same rule; this only hides controls. */
export function hasRole(actual: Role | undefined, required: Role): boolean {
  return actual !== undefined && ROLE_LEVEL[actual] >= ROLE_LEVEL[required]
}

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
