# Architecture

```
 Browser (React, Vercel)
     │  HTTPS + Bearer token (8 h)
     ▼
 Backend API (Node.js, Express, Prisma; Render)
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
 PostgreSQL (Neon)

 AI service (Python, FastAPI; Render), called only by the backend with a shared token
     ├── /parse    PDF → numbered clauses with pages (PyMuPDF, no AI)
     └── /extract  clauses → proposed obligations (Gemini), then deterministic checks:
                   schema, exact quote, numbers/dates in quote, vague terms
```

## Principles in the code

| Principle | Where it is enforced |
|---|---|
| AI reads | `ai-service/app/extraction/`: the only place an LLM is called |
| Humans verify | `backend/src/routes/obligation-review.ts`: only `approved`/`edited` obligations compile (`rule-engine/compile.ts`) |
| Deterministic rules evaluate | `backend/src/rule-engine/evaluate.ts`: a pure function with 29 tests, including 100 repeated runs |
| Every result remains traceable | Each evaluation stores the rule version, inputs, date and clause/page; `audit_log` rejects UPDATE/DELETE |

## Data model (main tables)

- `documents` → `document_versions` → `clauses` → `obligations` (versioned via `previous_version_id`)
- `obligation_reviews`: before/after snapshot of every review action
- `rules`: immutable and versioned; `is_active` marks the current version
- `entity_profiles`: fictional entities; `is_simulation` for what-if copies
- `evaluations`: inputs used, result and explanation, with source reference
- `change_events`, `impact_items`: version comparison and what it affects
- `conflict_flags`, `risk_config`, `extraction_runs`, `extraction_cache`, `audit_log`

## Hosting (free tier)

| Part | Host | Note |
|---|---|---|
| Frontend | Vercel | Deployed with `vercel deploy --prod` from `frontend/` |
| Backend | Render free web service | Runs `prisma migrate deploy` on start |
| AI service | Render free web service | Gemini free tier, with a fallback chain of models |
| Database | Neon free | Development uses the `dev-local` branch |

Deploys are triggered manually (Render API or dashboard), because the GitHub repository belongs to another account.
