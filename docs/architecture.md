# ClauseTrace Architecture

```
 Browser (React 19, Vite, Tailwind CSS 4; Vercel)
     │  HTTPS + Bearer token (8 h)
     ▼
 Backend API (Node.js 22, Express 5, Prisma ORM; Render)
     ├── auth & roles (viewer < reviewer < admin), checked on every request
     ├── documents, versions, clauses (PDF bytes stored in Postgres)
     ├── extraction runs (background, batched, cached)  ──►  AI service
     ├── review workflow (approve / edit = new version / reject)
     ├── rule compiler + deterministic rule engine (pure TypeScript, no AI)
     ├── evaluations, dashboard, risk scoring, conflicts, simulations
     ├── version comparison + impact analysis
     └── audit log (append-only, enforced by a database trigger)
     │
     ▼
 PostgreSQL (Neon Serverless)

 AI service (Python 3.11, FastAPI, PyMuPDF; Render), called only by the backend with a shared token
     ├── /parse    PDF → numbered clauses with pages (PyMuPDF, no AI)
     └── /extract  clauses → proposed obligations (Gemini), then deterministic checks:
                   schema, exact quote, numbers/dates in quote, vague terms
```

---

## Core Regulatory Principles in the Code

| Principle | Enforcement Mechanism | Code Location |
|---|---|---|
| **AI Proposes, Code Verifies, Humans Approve** | Only `approved` or `edited` obligations can ever compile into executable rules. The UI never presents raw AI text as a determination. | `ai-service/app/extraction/`, `backend/src/routes/obligation-review.ts`, `backend/src/rule-engine/compile.ts` |
| **Deterministic Rules Evaluate** | Pure TypeScript logic with zero AI. Identical outputs across 100+ consecutive runs; missing data is strictly `INSUFFICIENT_DATA`. | `backend/src/rule-engine/evaluate.ts`, `frontend/src/lib/rules.ts` |
| **Complete Traceability Chain** | Every result links backward through an unbroken lineage from result to exact PDF page and quote. Missing provenance links are explicitly flagged. | `backend/src/routes/evaluations.ts`, `frontend/src/components/flow/TraceFlow.tsx` |
| **Non-Color-Only Status & Accessibility** | Status badges never rely on color alone; every state pairs a distinct SVG icon, textual label, and high-contrast border pattern. | `frontend/src/components/ui/StatusBadge.tsx`, `frontend/src/components/ui/ResultBadge.tsx` |
| **Strict Role-Based Access Control (RBAC)** | Role hierarchy: `viewer` < `reviewer` < `admin`. Viewers are strictly read-only and command palette suppresses `/audit` and `/users`. | `backend/src/lib/auth.ts`, `frontend/src/lib/searchIndex.ts` |
| **Free-Tier Resilience** | Backend wake-up (>3.5s) triggers visual progress indicator without blank screens. Heavy dependencies (`pdfjs-dist`, `@xyflow/react`) are chunked. | `frontend/src/components/ui/WakeUpIndicator.tsx`, `frontend/src/lib/api.ts` |

---

## Frontend Architecture & Visual Upgrade Components

The frontend is built on React 19 with Tailwind CSS 4, utilizing a dedicated FinTech palette:
- **Base Colors:** Deep Pine Charcoal (`#2C3531`), Deep Sea Teal (`#116466`), Warm Golden Sand (`#D9B08C`), Soft Apricot Peach (`#FFCB9A`), Pale Sage Mint (`#D1E8E2`).
- **Typography:** *Plus Jakarta Sans* (clean UI) and *Space Grotesk* (display/headings).

```
frontend/src/
├── components/
│   ├── command/
│   │   └── CommandPalette.tsx         # Ctrl/Cmd+K palette using cmdk with strict RBAC filtering
│   ├── diff/
│   │   ├── BlastRadiusView.tsx        # Cascading impact animation (Clause -> Ob -> Rule -> Results)
│   │   └── SideBySideDiff.tsx         # Split & unified word-level clause diff with moved detection
│   ├── flow/
│   │   ├── TraceFlow.tsx              # React Flow animated provenance graph (Result -> PDF page)
│   │   ├── TraceNode.tsx              # Custom interactive node with expand/collapse and missing alerts
│   │   └── TraceListFallback.tsx      # Semantic accessible list fallback (<ol>) for screen readers
│   ├── heatmap/
│   │   ├── ComplianceHeatmap.tsx      # Matrix grid: Entities x Rules with density switch & sticky headers
│   │   ├── HeatmapDrawer.tsx          # Slide-over explanation & frozen input drawer
│   │   └── HeatmapExport.ts           # CSV and PNG export generators
│   ├── pdf/
│   │   ├── PdfControls.tsx            # Zoom, page navigation, modality & status filters
│   │   ├── PdfLegend.tsx              # Modality fills (MUST, MUST NOT) & status outline styles
│   │   └── PdfViewer.tsx              # Canvas text-layer quote highlighter with hover obligation cards
│   ├── tour/
│   │   └── GuidedTour.tsx             # 5-step interactive first-run tour with persistence
│   └── ui/
│       ├── Card.tsx, Drawer.tsx       # Accessible container primitives
│       ├── StatusBadge.tsx            # Dual-coded obligation status badges (icon + text + outline)
│       ├── ResultBadge.tsx            # Compliance result badges (PASS, FAIL, UPCOMING, INSUFFICIENT)
│       ├── ModalityBadge.tsx          # Modality chips (MUST, MUST NOT, SHOULD, MAY)
│       ├── ThemeToggle.tsx            # Light / dark / system theme switcher
│       └── WakeUpIndicator.tsx        # Render free-tier cold-start banner
├── lib/
│   ├── changeDetection.ts             # Moved/renumbered clause detection logic
│   ├── diff.ts                        # Word-level LCS diff algorithm
│   ├── pdfHighlight.ts                # Pure PDF coordinate to viewport text-layer matcher
│   ├── searchIndex.ts                 # Search indexing and role-based route suppression
│   ├── theme.ts                       # Theme controller and prefers-color-scheme listener
│   └── tour.ts                        # Guided tour state and event dispatching
```

---

## Data Model & Lineage Tracking

- `documents` → `document_versions` → `clauses` → `obligations` (versioned via `previous_version_id`)
- `obligation_reviews`: Before/after snapshot of every human review action
- `rules`: Immutable and versioned ($v_1, v_2, \dots$); `is_active` marks the current version
- `entity_profiles`: Financial entities; `is_simulation` for what-if balance sheet tests
- `evaluations`: Inputs used snapshot, result, and explanation, anchored to exact source quote and page
- `change_events`, `impact_items`: Version comparison and downstream blast radius
- `conflict_flags`, `risk_config`, `extraction_runs`, `extraction_cache`, `audit_log`

---

## Hosting & Deployment

| Service | Provider | Configuration |
|---|---|---|
| **Frontend** | Vercel | Single-page application with client-side routing rewrites |
| **Backend API** | Render | Node.js web service; executes `prisma migrate deploy` on startup |
| **AI Service** | Render | FastAPI container; shared secret authentication |
| **Database** | Neon | Serverless PostgreSQL with trigger-enforced immutable audit tables |
