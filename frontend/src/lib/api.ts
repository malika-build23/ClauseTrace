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

export async function apiSend<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (res.status === 204 ? null : res.json()) as Promise<T>
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

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  orgId?: string
  createdAt?: string
  lastLoginAt?: string | null
  organisation?: { id: string; name: string }
}

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

// ─── Review, rules, profiles, evaluations, dashboard ──────────────────────

export type EvaluationResult = 'PASS' | 'UPCOMING_DEADLINE' | 'FAIL' | 'INSUFFICIENT_DATA'

export type ObligationListItem = Obligation & {
  reviewPriority: 'high' | 'medium' | 'low' | null
  priorityReasons: string[]
  clause: {
    clauseNumber: string
    page: number
    documentVersion: { versionNo: number; document: { id: string; title: string } }
  }
}

export type ReviewHistoryEntry = {
  id: string
  version: number
  status: ObligationStatus
  createdAt: string
  approvedBy: { name: string } | null
  reviews: {
    action: 'approve' | 'edit' | 'reject'
    comment: string | null
    createdAt: string
    beforeJson: Record<string, unknown>
    afterJson: Record<string, unknown> | null
    reviewer: { name: string }
  }[]
}

export type ObligationDetail = Omit<Obligation, 'clause'> & {
  clause: {
    id: string
    clauseNumber: string
    page: number
    text: string
    documentVersion: { versionNo: number; document: { id: string; title: string } }
  }
  approvedBy: { name: string } | null
  entityCategories: { entityCategory: { name: string } }[]
  nextVersion: { id: string } | null
  rules: { id: string; ruleKey: string; ruleVersion: number; isActive: boolean }[]
  history: ReviewHistoryEntry[]
}

export type RuleDefinitionJson = {
  rule_id: string
  rule_version: number
  obligation_id: string
  applies_to: string[]
  type: 'threshold' | 'deadline' | 'required_field'
  input_field: string
  operator?: string
  value?: number
  unit?: string | null
  due_date?: string
  upcoming_window_days?: number
}

export type RuleRow = {
  id: string
  ruleKey: string
  ruleVersion: number
  type: RuleDefinitionJson['type']
  definitionJson: RuleDefinitionJson
  isActive: boolean
  createdAt: string
  createdBy: { name: string }
  obligation: {
    id: string
    obligationKey: string
    version: number
    subject: string
    action: string
    quote: string
    clause: { clauseNumber: string; page: number; documentVersion: { versionNo: number; document: { id: string; title: string } } }
  }
}

export type CompileResponse = {
  summary: { created: number; newVersion: number; unchanged: number; skipped: number }
  outcomes: { obligationId: string; obligationKey: string; outcome: string; ruleKey?: string; ruleVersion?: number; reason?: string }[]
}

export type ProfileValue = number | string | boolean | null

export type EntityProfile = {
  id: string
  name: string
  dataJson: Record<string, ProfileValue>
  isSimulation: boolean
  baseProfileId: string | null
  createdAt: string
  category: { id: string; name: string }
}

export type EvaluationDetails = {
  explanation: string
  ruleKey: string
  obligation: { key: string; version: number; quote: string; approvedBy: string | null }
  source: { documentId: string; document: string; documentVersion: number; clause: string; page: number }
}

export type EvaluationRow = {
  id: string
  ruleId: string
  ruleVersion: number
  profileId: string
  inputRef: Record<string, unknown>
  evaluationDate: string
  result: EvaluationResult
  detailsJson: EvaluationDetails
  evaluatedAt: string
  isSimulation: boolean
  rule: { ruleKey: string; ruleVersion: number; type: string; definitionJson: RuleDefinitionJson; isActive: boolean }
  profile: { id: string; name: string; isSimulation: boolean }
}

export type ResultCounts = Record<EvaluationResult, number>

export type DashboardSummary = {
  documents: number
  obligations: { proposed: number; approved: number; edited: number; rejected: number; ambiguousProposed: number }
  rules: { active: number; byType: Record<string, number> }
  results: ResultCounts
  profiles: { id: string; name: string; counts: ResultCounts; lastEvaluatedAt: string | null }[]
  riskWeights: RiskWeights
  attention: {
    risk: Risk
    evaluationId: string
    result: EvaluationResult
    ruleKey: string
    ruleVersion: number
    profileId: string
    profileName: string | null
    evaluatedAt: string
    details: EvaluationDetails
  }[]
  unresolvedChanges: number
}

export type ImpactItem = {
  id: string
  reviewStatus: 'pending' | 'confirmed' | 'draft_created' | 'dismissed'
  obligation: { id: string; obligationKey: string; version: number; status: ObligationStatus; subject: string; action: string } | null
  rule: { id: string; ruleKey: string; ruleVersion: number; isActive: boolean } | null
  evaluations: Partial<Record<EvaluationResult, number>>
}

export type ChangeEvent = {
  id: string
  changeType: 'added' | 'removed' | 'modified'
  clauseRef: string
  oldText: string | null
  newText: string | null
  summary: string | null
  status: 'pending' | 'confirmed' | 'dismissed'
  impactItems: ImpactItem[]
}

export type ChangesResponse = { fromNo: number | null; toNo: number | null; compared?: boolean; changes: ChangeEvent[] }

export type Risk = { score: number; level: 'high' | 'medium' | 'low'; reasons: string[] }

export type RiskWeights = {
  fail: number
  overdue: number
  upcoming: number
  upcomingPerDayInside: number
  insufficient: number
  pendingChange: number
  highThreshold: number
  mediumThreshold: number
}

export type GraphNode = {
  id: string
  kind: 'regulator' | 'document' | 'version' | 'clause' | 'obligation' | 'category' | 'rule' | 'result'
  label: string
  detail?: string
  href?: string
}
export type GraphResponse = { nodes: GraphNode[]; edges: { from: string; to: string; label: string }[]; impact: { obligations: number; rules: number; entities: number } }

type ConflictSide = {
  id: string
  obligationKey: string
  version: number
  status: ObligationStatus
  subject: string
  action: string
  quote: string
  thresholdJson: Threshold | null
  clause: { clauseNumber: string; page: number; documentVersion: { versionNo: number; document: { id: string; title: string } } }
}
export type ConflictFlag = {
  id: string
  reason: string
  status: 'flagged' | 'confirmed' | 'resolved' | 'not_a_conflict'
  createdAt: string
  reviewedBy: { name: string } | null
  obligationA: ConflictSide
  obligationB: ConflictSide
}
