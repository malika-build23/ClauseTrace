# ClauseTrace
#by Malika and Harsh

**AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.**

ClauseTrace turns dense financial regulatory circulars into machine-checkable, traceable compliance obligations, keeping a human compliance professional in control of every critical decision. 

The platform is purpose-built for the regulatory framework of the **International Financial Services Centres Authority (IFSCA)**, specifically governing **Fund Management Entities (FMEs)** within **GIFT City IFSC**.

> **Live Deployment:** [https://clausetrace-eight.vercel.app](https://clausetrace-eight.vercel.app)  
> *(Hosted on free-tier infrastructure; the backend servers sleep when idle and may take 30–60 seconds to wake up on the first request.)*  
>  
> **Accounts:** You can create an instant account via the [Sign Up page](https://clausetrace-eight.vercel.app/signup), or use the pre-seeded demo accounts.
>
> **Current Stage:** Working Prototype. All core pipeline stages (ingestion → AI extraction → human review queue → rule compilation → deterministic evaluation → dashboard → amendment diffing → append-only audit trail) operate end-to-end with public IFSCA circulars and fictional entity data.

---

## 1. The Problem We Solve

In modern international financial hubs like GIFT IFSC, financial institutions face rapid regulatory evolutions:

1. **Dense, Cross-Referenced Circulars:** Regulatory circulars contain numerical limits, investment ceilings, lock-in periods, disclosure duties, and strict reporting windows scattered across complex nested clauses.
2. **The Danger of Chatbot Hallucinations:** Generic generative AI chatbots cannot be trusted with legal compliance. They hallucinate thresholds, misinterpret conditions, invent non-existent exemptions, and produce non-reproducible answers.
3. **Manual Spreadsheet Fragility:** Tracking compliance via manual spreadsheets is slow, breaks when circulars are amended, and fails to provide verifiable lineage back to exact legal text for regulatory audits.

---

## 2. What ClauseTrace Does

```
┌─────────────────┐      ┌─────────────────────────┐      ┌──────────────────────────┐
│  Regulatory PDF │ ──►  │    PyMuPDF Parser       │ ──►  │    AI Extraction (LLM)   │
│  (IFSCA Circular)│      │  (Numbered Hierarchies) │      │  (Gemini + Guardrails)   │
└─────────────────┘      └─────────────────────────┘      └────────────┬─────────────┘
                                                                       │
┌──────────────────────────┐      ┌──────────────────────────┐         ▼
│ Deterministic Evaluation │ ◄──  │ Versioned Rule Compiler  │ ◄── [Human Review Queue]
│ (Pure TS: PASS/FAIL/...) │      │ (Threshold/Deadline/Req) │     (Approve / Edit / Reject)
└────────────┬─────────────┘      └──────────────────────────┘
             │
             ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ Bidirectional Audit Trail│ ──►  │ Amendment Diff & Impact  │
│ (Trigger-locked Postgres)│      │ (Resilient to Renumbering│
└──────────────────────────┘      └──────────────────────────┘
```

1. **Hierarchical PDF Parsing:** Splits incoming regulatory PDFs into numbered clauses (`1.`, `4.2`, `(a)`, `(i)`) while preserving parent-child hierarchies and physical page citations without OCR dependencies.
2. **AI Extraction with Deterministic Guardrails:** Gemini structures raw legal text into formal obligation proposals (subject, modality, action, threshold, deadline). Code, not AI, enforces strict anti-hallucination rules:
   - Rejects any obligation whose supporting quote is not found word-for-word in the clause text.
   - Rejects any threshold whose numbers (including *crore, lakh, million, thousand*) are not present in the quote.
   - Automatically flags vague legal terminology (*"adequate"*, *"appropriate"*, *"promptly"*, *"wherever feasible"*).
   - Source metadata (document, version, clause, page) is injected directly from the database and can never be hallucinated by the model.
3. **Human-in-the-Loop Review Queue:** Compliance officers review proposed obligations ranked by an explainable priority formula. Reviewers can approve, edit (which creates an immutable version $v_{n+1}$ while archiving $v_n$), reject with mandatory feedback, or mark subjective obligations as "reference-only".
4. **Deterministic Rule Compiler:** Converts approved, machine-checkable obligations into immutable, versioned rules using standardized templates (`threshold`, `deadline`, `required_field`).
5. **Pure Mathematical Rule Engine:** A deterministic TypeScript engine checks entity profiles against active rules. Zero AI is used in evaluations. The engine returns:
   - `PASS`: Compliant with the rule.
   - `FAIL`: Non-compliant with the rule.
   - `UPCOMING_DEADLINE`: Compliant but deadline is approaching within the alert window.
   - `INSUFFICIENT_DATA`: Missing input data or currency/unit mismatch (e.g., rule in `USD`, profile in `INR`). The engine never guesses conversions or passes silently.
6. **Full-Chain Bidirectional Traceability:** Any evaluation result links directly back through the chain:  
   $$\text{Evaluation Result} \longrightarrow \text{Rule Version} \longrightarrow \text{Approved Obligation} \longrightarrow \text{Reviewer Identity} \longrightarrow \text{Exact Quote} \longrightarrow \text{Clause} \longrightarrow \text{PDF Page}$$
7. **Regulatory Amendment Diffing & Impact Analysis:** Compares two circular versions clause-by-clause. It recognizes structural renumbering without flagging false changes, identifies `added`, `modified`, or `removed` obligations, and surfaces all downstream rules and entities affected by the amendment.
8. **Isolated What-If Simulation Sandbox:** Allows compliance managers to clone an entity profile and run hypothetical balance sheet or capital scenarios. Simulations are explicitly isolated (`is_simulation: true`) and never pollute production audit logs or compliance dashboards.
9. **Contradiction & Conflict Detection:** Flags overlapping obligations with conflicting thresholds or requirements across circulars for human adjudication.
10. **Append-Only Audit Log:** Every login, review, rule compilation, and evaluation is recorded in an audit table protected by PostgreSQL triggers that reject `UPDATE` and `DELETE` operations.

---

## 3. Architecture & Tech Stack

| Layer | Technology | Hosting | Purpose |
|---|---|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, React Router 7 | Vercel | Responsive UI: PDF viewer, review queues, rule compiler, dashboards, and simulators |
| **Backend API** | Node.js 22, Express 5, Prisma ORM 6, TypeScript 5.9 | Render | REST API, RBAC, deterministic rule compiler & evaluator, diff engine, audit logger |
| **AI Microservice** | Python 3.11, FastAPI, PyMuPDF, Google Gemini API | Render | Document layout parsing, structured obligation extraction, and deterministic quote verification |
| **Database** | Serverless PostgreSQL (Neon) | Neon | Relational schema (16 models) with branch isolation (`dev-local` vs production) |

---

## 4. User Roles & Access Control

| Role | Permissions |
|---|---|
| **Viewer** | Read-only access to documents, clauses, approved obligations, rules, entity profiles, and dashboards. |
| **Reviewer** | All Viewer capabilities, plus: upload circulars, trigger AI extractions, approve/edit/reject obligations, compile rules, execute evaluations, compare circular versions, flag conflicts, and inspect audit logs. |
| **Admin** | All Reviewer capabilities, plus: manage organisation users, deactivate accounts, and configure risk prioritization weights. |

*Self-service user registration via `/signup` automatically grants the **Reviewer** role to allow complete exploration of all core features.*

---

## 5. Local Development Setup

### Prerequisites
- Node.js 22+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- Neon CLI (`npm install -g neon`) or local PostgreSQL instance

### 1. Clone & Environment Setup
```bash
git clone https://github.com/malika-build23/ClauseTrace.git
cd ClauseTrace
cp .env.example .env.dev.local
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed demo org, default circulars, and fictional entity profiles
npm run dev           # Runs API on http://localhost:4000
```

### 3. AI Service Setup
```bash
cd ../ai-service
uv venv
uv pip install -r requirements-dev.txt

# Run the FastAPI service on http://localhost:8000
GEMINI_API_KEY=<your-key> AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev           # Runs UI on http://localhost:5173
```

---

## 6. Testing & Automated Verification

ClauseTrace features automated test coverage across its deterministic and security-critical systems:

```bash
# 1. Backend test suite (90 tests: evaluator determinism, 100-run repeatability, rule compiler, diff engine)
cd backend
npm test

# 2. AI Service test suite (39 tests: PDF parsing, quote matching, multiplier checks with fake LLM)
cd ../ai-service
uv run pytest

# 3. Frontend validation
cd ../frontend
npm run lint && npm run build

# 4. Automated end-to-end traceability verification
cd ../ai-service
uv run --no-project python ../scripts/evaluate_traceability.py <api-url>
```

---

## 7. Known Limitations & Roadmap

- **Scanned Documents:** The PDF parser currently relies on digital text streams via PyMuPDF; scanned or image-only circulars require an upstream OCR engine (e.g., Tesseract or AWS Textract).
- **Tabular Regulatory Data:** Tables in circulars are flattened into line streams; multi-column capital adequacy tables currently require manual reviewer structuring.
- **Sub-Clause Parent Context:** Child clauses (e.g., `22(ii)`) are extracted independently; passing parent clause headers into child extraction contexts is planned for Phase 2.
- **Gold-Label Independence:** Initial precision/recall benchmarks were drafted alongside model exploration; independent double-blind labeling by regulatory counsel is underway.
- **Fictional Data:** All entity balance sheets, investor figures, and fund profiles in demo seeds are fictional and used solely for testing and demonstration.

---

## 8. Authors & Project Origin

Created by **Malika** and **Harsh** for the **GIFT FutureLab Grand Challenge**.

ClauseTrace demonstrates how regulated financial entities and supervisory bodies can leverage modern generative AI safely: using AI where it excels (rapid text parsing and extraction proposal) while anchoring compliance decisions where they belong (human expertise, pure mathematical determinism, and unalterable audit trails).
