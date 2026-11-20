# ClauseTrace 2.0: Single-Pass Implementation Plan

**Core principle:** AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.

**Goal of this plan:** Build the complete system in one continuous implementation run, not spread over weeks. The build is ordered by dependency (foundation → data → services → UI → differentiators → verification), and every feature ships in the same pass. Each build block has a "Done when" check that must pass before the next block starts, so the single pass stays verifiable.

**Scope:** Everything previously split into P0–P3 is in scope for this single pass. The only items that remain optional are marked **(optional)**.

---

## 0. Ground Rules

1. **Narrow slice:** 2–3 public IFSCA circulars for **one regulatory area** and **one entity category** (e.g., Fund Management Entity), plus one amended version for change detection.
2. **Fictional entity data only.** Label all sample thresholds and rules as illustrative.
3. **No unproven claims:** No accuracy, validation, or deployment claims until measured.
4. **Only approved + machine-checkable obligations** may become executable rules.
5. **Simulations are never mixed with real compliance records.**
6. **Every record keeps source traceability:** document, version, clause, page, quote.
7. **Build order is strict:** a block is finished only when its "Done when" check passes. Do not start a dependent block on a failing one.

---

## 1. Build Overview

| Block | Scope | Depends on |
|---|---|---|
| **A** | Setup, repo, tooling, locked decisions | — |
| **B** | Obligation schema + database + seed | A |
| **C** | PDF parsing + document ingestion | B |
| **D** | LLM extraction service + validation | B, C |
| **E** | Auth and roles | B |
| **F** | Rule engine (tests first), compiler, evaluator | B |
| **G** | Review UI + entity profiles + dashboard | C, D, E, F |
| **H** | Version comparison, impact analysis | C, D, G |
| **I** | Audit trail UI, rule versioning, historical view | E, F, H |
| **J** | Confidence/ambiguity, knowledge graph, risk prioritisation | G, H |
| **K** | Conflict detection, what-if simulator | F, G, J |
| **L** | Evaluation, testing, demo assets, README | all |

Blocks that do not depend on each other (for example D / E / F after B) can be built in parallel by separate people or agents. With one implementer, build them in the listed order.

---

## 2. Block A: Project Setup

### 2.1 Decisions to lock up front
- [ ] Regulatory area and entity category
- [ ] 2–3 source PDFs (public IFSCA) + 1 amended version (real, or a manually edited copy)
- [ ] LLM provider (Gemini API or alternative) and API key handling
- [ ] Team roles, if more than one implementer (see section 19)

### 2.2 Repository structure

```text
clausetrace/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── obligation-schema.md
│   └── evaluation.md
├── data/
│   ├── raw-pdfs/              # public IFSCA documents
│   ├── gold-labels/           # manually labelled clauses
│   └── sample-entities/       # fictional profiles (JSON)
├── frontend/                  # React + Tailwind
├── backend/                   # Node.js + Express + Prisma
├── ai-service/                # Python + FastAPI
│   ├── parser/
│   ├── extraction/
│   └── diff/
├── rule-engine/               # shared module (TypeScript)
├── scripts/                   # PoC extraction scripts, eval scripts
└── docker-compose.yml         # Postgres (+ Redis optional)
```

### 2.3 Tooling
- [ ] Git repo with `main` and short-lived feature branches
- [ ] Docker Compose for PostgreSQL
- [ ] `.env.example` (DB URL, LLM key, JWT secret)
- [ ] Linting/formatting (ESLint, Prettier, Ruff/Black)
- [ ] UI/UX Pro Max plugin installed for frontend design work (see section 2.4)

### 2.4 Frontend design guidance
Use the **UI/UX Pro Max** plugin when building every frontend screen (upload, review, dashboard, diff, audit, graph, simulator). Establish one design system first (colour tokens, type scale, spacing, status badge styles for PASS / FAIL / UPCOMING / INSUFFICIENT_DATA / SIMULATION) and reuse it across all screens.

**Done when:** `docker compose up` starts the database, and frontend/backend/ai-service each respond to a "hello world" request.

---

## 3. Block B: Schema, Database, Seed

### 3.1 Obligation schema
One schema is shared by the AI service, database, review UI, and rule engine.

```json
{
  "obligation_id": "FME-EXAMPLE-c4.2-01",
  "source": {
    "document": "Example regulatory document",
    "document_version": 1,
    "date": "YYYY-MM-DD",
    "clause": "4.2",
    "page": 3,
    "quote": "Exact source text"
  },
  "subject": "Example regulated entity",
  "modality": "must",
  "action": "maintain a required measure",
  "condition": "as specified in the source clause",
  "threshold": { "metric": "example_metric", "operator": ">=", "value": 1000000, "unit": "USD" },
  "deadline": null,
  "evidence": "Evidence specified by the regulation",
  "ambiguity_flag": false,
  "ambiguity_reason": null,
  "machine_checkable": true,
  "confidence": 0.82,
  "status": "proposed",
  "approved_by": null,
  "version": 1
}
```

**Rules**
- `modality` ∈ `must | must_not | may | should`
- `operator` ∈ `>= | > | <= | < | == | !=`
- `status` ∈ `proposed | approved | edited | rejected`
- `machine_checkable` is `true` only when threshold/deadline/condition is explicit.
- Validate with **Pydantic** (Python) and **Zod** (Node). Reject invalid LLM output and retry once.
- Placeholder values are never presented as real IFSCA figures.

### 3.2 Database (PostgreSQL + Prisma)
Model graph-like relationships with foreign keys.

| Table | Key fields |
|---|---|
| `users` | id, name, email, password_hash, role (`admin`, `reviewer`, `viewer`), org_id |
| `organisations` | id, name |
| `documents` | id, title, regulator, publish_date, file_path, status, created_by |
| `document_versions` | id, document_id, version_no, file_hash, uploaded_at, parsing_status |
| `clauses` | id, document_version_id, clause_number, page, text, parent_clause_id |
| `obligations` | id, clause_id, subject, modality, action, condition, threshold_json, deadline, evidence, machine_checkable, ambiguity_flag, confidence, review_priority, status, version |
| `obligation_reviews` | id, obligation_id, reviewer_id, action (`approve/edit/reject`), before_json, after_json, comment, created_at |
| `entity_categories` | id, name |
| `obligation_entity_categories` | obligation_id, entity_category_id |
| `rules` | id, obligation_id, rule_version, definition_json, is_active, created_by, created_at |
| `entity_profiles` | id, org_id, name, category_id, data_json, is_simulation |
| `evaluations` | id, rule_id, rule_version, profile_id, input_ref, result (`PASS/FAIL/UPCOMING_DEADLINE/INSUFFICIENT_DATA`), details_json, evaluated_at, is_simulation |
| `change_events` | id, old_version_id, new_version_id, change_type (`added/modified/removed`), clause_ref, summary, status |
| `impact_items` | id, change_event_id, obligation_id, rule_id, review_status |
| `conflict_flags` | id, obligation_a_id, obligation_b_id, reason, status (`flagged/confirmed/resolved/not_a_conflict`), reviewed_by |
| `risk_config` | id, org_id, weights_json, updated_by |
| `audit_log` | id, actor_id, event_type, object_type, object_id, payload_json, created_at |

All tables (including the P2/P3 tables `conflict_flags` and `risk_config`) are created in one initial migration so later blocks do not need schema rework.

### 3.3 Steps
- [ ] Write the Prisma schema
- [ ] Run the migration
- [ ] Write the seed script (admin user, reviewer user, viewer user, entity category, 3–4 fictional profiles designed to produce Pass, Fail, Upcoming, and Insufficient Data)

**Done when:** Seed data loads and a document → clause → obligation chain can be queried.

---

## 4. Block C: PDF Parsing and Document Ingestion

### 4.1 AI service (FastAPI)
- `POST /parse` — input: PDF; output: list of `{clause_number, page, text, parent}`
- Extract text with **PyMuPDF** (fallback: pdfplumber), keeping page numbers
- Clean headers/footers
- Split clauses using numbering patterns (`1.`, `1.1`, `(a)`, `(i)`) and detect parent/child
- Fallback: if no numbering is detected, split by paragraph and flag `needs_manual_split`

### 4.2 Backend (Express)
- `POST /api/documents` — upload (Multer), compute SHA-256 hash, create `documents` + `document_versions`
- Call the AI service to parse; store clauses; set `parsing_status`
- `GET /api/documents/:id/clauses`

### 4.3 Frontend
- Upload page with progress and parsing status
- Document view listing clauses with page numbers

**Done when:** Uploading a PDF shows its clauses with correct page and clause references. Spot-check at least 20 clauses manually, and record bad splits for the limitations notes.

---

## 5. Block D: AI Extraction Service

### 5.1 Implementation
- `POST /extract` — input: clause text + metadata; output: schema-valid obligations (array, possibly empty)
- Prompt rules:
  - Extract **only** what is explicitly stated.
  - Use `null` when a field is not stated; never guess thresholds or dates.
  - Copy the exact supporting quote.
  - Set `ambiguity_flag` and reason for vague text ("adequate", "appropriate", "as may be specified").
  - Output JSON only.
- Use structured output/JSON mode if the provider supports it.
- Validation chain: schema check → verify `quote` appears in the clause text (reject otherwise) → verify numeric values appear in the quote.
- Retry once on invalid output; log failures.
- Process clauses with a simple async loop (BullMQ optional).
- Cache LLM outputs by clause hash so reruns and the demo do not depend on live calls.

### 5.2 Backend
- `POST /api/documents/:id/extract` — triggers extraction
- Store results as `status = proposed`
- Write `audit_log` entries

**Done when:** One document produces proposed obligations, each tied to a clause, and invalid LLM outputs are rejected. Record correct / incorrect / missed counts for 20–30 obligations as the first quality notes.

---

## 6. Block E: Authentication and Roles

- JWT login; bcrypt password hashing
- Roles: `admin` (manage users), `reviewer` (approve/edit/reject), `viewer` (read-only)
- Middleware: `requireRole('reviewer')` on all review/approve endpoints; `requireRole('admin')` on user management
- Frontend: login page, protected routes, role-aware UI

**Done when:** A viewer cannot approve an obligation, and the API enforces it (not only the UI).

---

## 7. Block F: Deterministic Rule Engine (tests first)

### 7.1 Rule definition format

```json
{
  "rule_id": "RULE-101",
  "rule_version": 1,
  "obligation_id": "FME-EXAMPLE-c4.2-01",
  "type": "threshold",
  "input_field": "example_metric",
  "operator": ">=",
  "value": 1000000,
  "unit": "USD",
  "applies_to": ["Fund Management Entity"]
}
```

Supported rule types:
1. `threshold` — numeric comparison (`>=`, `>`, `<=`, `<`, `==`)
2. `deadline` — date comparison against an evaluation date (configurable "upcoming" window, e.g., 30 days)
3. `required_field` — a required document/evidence/attribute is present (boolean)

### 7.2 Unit tests (write first)
- Value below / equal / above threshold
- Missing field, wrong unit
- Date before / on / after deadline, and inside the "upcoming" window
- Different rule versions
- 100 repeated evaluations produce identical results

### 7.3 Compiler
- Approved + `machine_checkable` obligation → rule definition (template-based mapping, **no LLM**)
- Validate rule JSON against a schema; reject incomplete rules
- Rules are immutable once saved; changes create a new `rule_version`

### 7.4 Evaluator (pure function)

```text
evaluate(rule, entityProfile, evaluationDate) -> {
  result: PASS | FAIL | UPCOMING_DEADLINE | INSUFFICIENT_DATA,
  inputs_used, rule_version, evaluated_at, explanation
}
```

- Same inputs → same output (no randomness, no LLM, no hidden state)
- Missing input → `INSUFFICIENT_DATA` (never silently pass or fail)
- Unit mismatch → `INSUFFICIENT_DATA` with an explanation
- `evaluationDate` is always passed explicitly

### 7.5 API
- `POST /api/rules/compile`
- `POST /api/evaluations` — body: profile_id, rule_ids (or all applicable)
- `GET /api/evaluations?profile_id=`

**Done when:** All rule-engine tests pass and each stored result includes rule version, input reference, timestamp, and clause reference.

---

## 8. Block G: Review UI, Entity Profiles, Dashboard

### 8.1 Review interface
- Review queue: filter by document, status, ambiguity flag, confidence; sort lowest confidence / ambiguous first
- Split-screen review page: **left** source clause (page number, quote highlighting); **right** editable extracted fields
- Buttons: **Approve**, **Edit & Approve**, **Reject** (comment required on reject)
- Visual flags: ambiguity warning, "not machine-checkable" label
- Banner: *"Confidence is a review aid, not proof of correctness."*

### 8.2 Review API
- `GET /api/obligations?status=proposed`
- `PATCH /api/obligations/:id/review` — body: action, edits, comment
- Each review writes to `obligation_reviews` and `audit_log` with before/after snapshots

### 8.3 Business rules
- Only `approved` obligations proceed to rule compilation.
- Editing creates a new obligation `version`; the previous version is preserved.
- Ambiguous obligations can be approved as "reference only" (non-executable).

### 8.4 Entity profiles
- Create/edit fictional profiles (category + key-value data such as `example_metric`, `reporting_date`)

### 8.5 Dashboard
- Summary cards: obligations (proposed/approved/rejected), active rules, checks passed/failed, upcoming deadlines
- Results table: rule, result badge, clause reference (link to source), evaluated at
- Drill-down: result → rule → obligation → source clause (with quote)
- Charts via Recharts (pass/fail distribution, review progress)
- `GET /api/dashboard/summary`

**Done when:** The full flow (upload → extract → approve → evaluate → dashboard) works end to end on the narrow slice, and a reviewer can process a full queue with every action visible in the audit log. **This is the core checkpoint: do not start Block H until it works reliably.**

---

## 9. Block H: Version Comparison and Impact Analysis

### 9.1 Version comparison
- Upload a new version of an existing document (`document_versions`)
- Align clauses by clause number first, then by text similarity (`difflib` / rapidfuzz; embeddings optional)
- Classify: **added**, **removed**, **modified** (with text diff), **unchanged**
- Store in `change_events`
- `POST /api/documents/:id/compare`

### 9.2 Impact mapping
- For each change, find linked obligations → rules → entity categories → past evaluations
- Create `impact_items` with `review_status = pending`
- Optionally re-run extraction only for changed clauses to propose updated obligations
- `GET /api/changes`, `GET /api/impact-items`

### 9.3 UI
- Side-by-side diff view with highlighted changes
- Impact summary and list of affected obligations/rules
- Reviewer actions: confirm change, create updated obligation draft, dismiss
- **Approved rules are never changed automatically; a reviewer must approve updates.**

**Done when:** Uploading an amended document shows correct added/modified/removed clauses and the linked impact items.

---

## 10. Block I: Audit Trail and Rule Versioning

- Central audit service: every create/edit/approve/reject/rule-change/evaluation writes an `audit_log` entry (actor, time, object, before/after)
- `GET /api/audit` with filters by object, user, date
- Audit UI: open any evaluation to see source document + version + clause + page, obligation version and approving reviewer, rule version used, and input data reference
- Historical view: show a past result using the rule version that was active at that time
- Audit log is append-only (no update/delete endpoints)

**Done when:** For any evaluation result, you can reconstruct *why* it produced that result.

---

## 11. Block J: Confidence, Knowledge Graph, Risk Prioritisation

### 11.1 Confidence and ambiguity indicators
- Combine: LLM-reported confidence, validation checks (quote found, numbers found), vague-term detector
- Present as Low/Medium/High **review priority** (not correctness); store in `obligations.review_priority`

### 11.2 Knowledge graph (PostgreSQL-based)
- Query layer over existing relations: Regulator → Document → Clause → Obligation → Entity Category → Rule → Check
- Frontend graph view (React Flow / Cytoscape.js / D3) showing the neighbourhood of a selected obligation
- "If this clause changes, what is affected?" traversal endpoint

### 11.3 Risk prioritisation
- Transparent scoring configured by reviewers (`risk_config`): deadline proximity, failed checks, unresolved changes, review backlog
- Display the *reasons* for each priority label (no black-box score)
- Dashboard section: overdue, failing, unresolved changes

**Done when:** Priority labels show their reasons, the graph renders for a selected obligation, and the traversal endpoint returns the same set the impact mapping finds.

---

## 12. Block K: Conflict Detection and What-If Simulator

### 12.1 Cross-regulation conflict detection
- Candidate pairs: obligations with the same subject/metric across documents
- Compare thresholds/deadlines; flag differences for review (**flag only, never conclude**)
- Reviewer statuses: confirmed / resolved / not a conflict
- Stored in `conflict_flags`

### 12.2 What-if simulator
- Clone a profile with modified values; evaluate with the same engine
- Store with `is_simulation = true`; exclude from compliance dashboards
- Show baseline vs. scenario comparison with a clear **"SIMULATION"** label

**Done when:** Simulated evaluations never appear in dashboard counts, and conflicts are only ever shown as flags awaiting review.

---

## 13. Block L: Evaluation, Testing, Demo, Submission

### 13.1 Extraction quality
1. Create a gold-label set in `data/gold-labels/`; have at least two teammates label independently where possible.
2. Run `scripts/evaluate_extraction.py` to compute **precision, recall, F1**.
3. Record common error types (missed condition, wrong threshold, hallucinated obligation, bad clause split).

### 13.2 Other checks
- **Change detection:** original/amended pairs; reviewer-verified added/modified/removed accuracy
- **Traceability:** sample 20+ obligations/results; confirm each links to the correct document, version, clause, page
- **Rule engine:** full unit suite plus the 100-run repeatability test
- **Human review stats:** approval/edit/reject rates from review logs
- Put real numbers in `docs/evaluation.md`. **If a test was not run, state that it was not run.**

### 13.3 Demo script
1. Upload a public IFSCA circular
2. Show parsing into clauses
3. Show AI-extracted obligations with source references
4. Review and approve selected obligations
5. Evaluate approved rules for a fictional profile
6. Show Pass / Fail / Upcoming results with clause references
7. Upload an amended document → show detected changes
8. Show affected obligations → request reviewer approval
9. Open the audit history for a result

### 13.4 Demo and submission checklist
- [ ] Pre-load demo data; cache LLM outputs (no live LLM calls during the demo)
- [ ] Record a backup video of the full flow
- [ ] Prepare slides with architecture diagram and the principle line
- [ ] Rehearse answers to likely jury questions (hallucinations, legal decisions, chatbot comparison, data protection, business model)
- [ ] Label illustrative thresholds and fictional data in the UI
- [ ] README: problem, solution, architecture diagram, setup instructions, obligation schema, sample output, **honest limitations and current stage**
- [ ] Application form: select only stages/validation statuses that are true on the submission day; inform teammates before ticking declarations; read every consent statement

---

## 14. Suggested Task Split (if more than one implementer)

Parallelise after Block B:
- **Member A (Frontend):** upload, review UI, dashboard, diff view, audit UI, graph view (using UI/UX Pro Max)
- **Member B (Backend):** auth, APIs, Prisma, audit service, impact service
- **Member C (AI/Docs):** PDF parsing, clause splitting, LLM extraction, validation, diff engine
- **Member D (Rules/QA):** rule schema, compiler, evaluator, tests, gold labels, evaluation, docs

A single implementer follows the block order A → L.

---

## 15. API Summary

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/documents` | Upload document/new version |
| GET | `/api/documents/:id/clauses` | List clauses |
| POST | `/api/documents/:id/extract` | Run AI extraction |
| GET | `/api/obligations` | List/filter obligations |
| PATCH | `/api/obligations/:id/review` | Approve/edit/reject |
| POST | `/api/rules/compile` | Compile approved obligations |
| POST | `/api/evaluations` | Run rule evaluation |
| GET | `/api/evaluations` | Results/history |
| GET/POST | `/api/entity-profiles` | Manage profiles |
| POST | `/api/documents/:id/compare` | Compare versions |
| GET | `/api/changes` / `/api/impact-items` | Changes and impact |
| GET | `/api/graph/:obligationId` | Knowledge graph neighbourhood and impact traversal |
| GET/POST | `/api/conflicts` | Conflict flags and reviewer status |
| POST | `/api/simulations` | Run what-if scenario |
| GET/PUT | `/api/risk-config` | Risk prioritisation weights |
| GET | `/api/audit` | Audit log |
| GET | `/api/dashboard/summary` | Dashboard aggregates |

---

## 16. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| PDF parsing is messy (tables, headers, numbering) | Start with 2–3 cleaner circulars; manual-split fallback; flag low-quality parses |
| LLM hallucinates thresholds/dates | Fixed schema, quote verification, numeric cross-check, mandatory human review |
| Large single-pass scope hides failures | Strict block order with a "Done when" gate per block; core checkpoint after Block G |
| LLM API limits/failures during demo | Cache outputs, pre-load data, backup video |
| Ambiguous regulatory language | Ambiguity flag; approve as reference-only; never auto-resolve |
| Rule engine silently wrong | Test-first development; `INSUFFICIENT_DATA` for missing inputs |
| Simulations polluting real records | `is_simulation` flag enforced in every dashboard query; tested in Block K |
| Unmeasured claims | Evaluation doc with real numbers only; README states the current stage honestly |

---

## 17. Definition of Done

- [ ] Upload PDF → clauses with page/clause references
- [ ] LLM proposes schema-valid obligations with source quotes
- [ ] Reviewers approve/edit/reject; actions are audited
- [ ] Approved machine-checkable obligations compile into versioned rules
- [ ] Rule engine returns repeatable Pass/Fail/Upcoming/Insufficient Data results
- [ ] Dashboard shows results with drill-down to source clause
- [ ] Amended document shows added/modified/removed clauses and impact items
- [ ] Any evaluation result is explainable through the audit trail
- [ ] Confidence/priority labels, knowledge graph, and risk reasons work
- [ ] Conflict flags and the simulator work and stay separated from real records
- [ ] Unit tests for the rule engine pass
- [ ] `docs/evaluation.md` contains real measured numbers (or states what was not run)
- [ ] README states the current stage and limitations honestly

**Final positioning:** ClauseTrace is an AI-assisted, human-verified regulatory intelligence and compliance platform that turns complex financial regulations into traceable, structured, and machine-checkable obligations.
