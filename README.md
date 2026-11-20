# ClauseTrace
### by Malika and Harsh

[![Status](https://img.shields.io/badge/Status-Working%20Prototype-116466?style=for-the-badge)](https://clausetrace-eight.vercel.app)
[![Challenge](https://img.shields.io/badge/GIFT%20FutureLab-Grand%20Challenge-D9B08C?style=for-the-badge)](https://clausetrace-eight.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-2C3531?style=for-the-badge)](LICENSE)

> **"AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable."**

ClauseTrace is an enterprise-grade Regulatory Technology (**RegTech**) platform that turns complex financial circulars into machine-executable compliance rules with strict human verification and mathematical auditability.

Purpose-built for the regulatory framework of the **International Financial Services Centres Authority (IFSCA)**, ClauseTrace focuses on Fund Management Entities (**FMEs**) operating within **GIFT City IFSC**.

---

## Quick Links

* 🌐 **Live Web Application:** [https://clausetrace-eight.vercel.app](https://clausetrace-eight.vercel.app)
* 🚀 **Local Web Console:** [http://localhost:5173](http://localhost:5173)
* 🔐 **Sign Up (Reviewer Access):** [http://localhost:5173/signup](http://localhost:5173/signup)
* 👤 **User Profile & Credentials:** [http://localhost:5173/profile](http://localhost:5173/profile)
* 🔌 **Backend REST API:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

*(Note: Free-tier servers sleep after 15 minutes of inactivity; allow 30–60 seconds for cold boot on first load.)*

---

## 1. Problem Statement

Financial institutions in international jurisdictions like GIFT IFSC navigate high-velocity, dense regulatory updates:

1. **Information Density & Ambiguity:** Legal circulars feature numerical caps, lock-in intervals, reporting timelines, and carve-outs scattered across parent-child clauses.
2. **The LLM Hallucination Trap:** Generic AI chatbots frequently invent non-existent exemptions, mistake advisory text for mandatory duties, and fail to provide deterministic consistency required for financial audits.
3. **Spreadsheet Fragility:** Manual compliance spreadsheets break when regulations are amended and fail to provide verifiable lineage back to exact legal citations during regulatory inspections.

---

## 2. Core Architecture & Workflow Pipeline

```
┌────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
│   Regulatory PDF       │ ──►  │    PyMuPDF Parser        │ ──►  │   AI Extraction (LLM)    │
│   (IFSCA Circular)     │      │   (Nested Hierarchies)   │      │ (Gemini 3.5/3.8 Cascade) │
└────────────────────────┘      └──────────────────────────┘      └────────────┬─────────────┘
                                                                               │
┌────────────────────────┐      ┌──────────────────────────┐                   ▼
│ Deterministic Engine   │ ◄──  │ Versioned Rule Compiler  │ ◄── [Human-in-the-Loop Review]
│ (Pure TS: PASS/FAIL/…) │      │ (Threshold/Deadline/Req) │     (Approve / Edit / Reject)
└───────────┬────────────┘      └──────────────────────────┘
            │
            ▼
┌────────────────────────┐      ┌──────────────────────────┐
│ Full Lineage & Audit   │ ──►  │ Amendment Diff & Impact  │
│ (Trigger-Locked DB)    │      │ (Renumbering-Resilient)  │
└────────────────────────┘      └──────────────────────────┘
```

1. **Hierarchical PDF Parsing:** Segments raw circulars into numbered clauses (`1.`, `4.2`, `(a)`, `(i)`) while preserving exact page numbers and parent/child associations.
2. **AI Extraction with Code Guardrails:** Gemini proposes structured obligations (subject, modality, action, threshold, deadline). Code—not the LLM—verifies proposals:
   * **Exact Quote Verification:** Rejects proposals whose supporting quote is not found verbatim in the source text.
   * **Numeric Cross-Check:** Discards thresholds unless the number (accounting for *crore, lakh, million, thousand*) appears in the verified quote.
   * **Vagueness Flagging:** Heuristically detects ambiguous terms (*"adequate"*, *"appropriate"*, *"promptly"*, *"wherever feasible"*).
   * **Zero Hallucination of Metadata:** Document, version, clause, and page fields are injected directly from the database and cannot be fabricated by the model.
3. **Human-in-the-Loop Review Queue:** Compliance officers triage obligations ordered by a transparent priority metric. Reviewers can approve, edit (generating an immutable version $v_{n+1}$ while archiving $v_n$), reject with feedback, or classify subjective requirements as non-executable "reference-only".
4. **Deterministic Rule Compiler:** Converts approved, machine-checkable obligations into immutable, versioned rules across fixed templates (`threshold`, `deadline`, `required_field`).
5. **Pure Mathematical Rule Engine:** Zero AI during evaluation. Pure TypeScript evaluates entity balance sheet and filing data:
   * `PASS`: Compliant with rule condition.
   * `FAIL`: Non-compliant with rule condition.
   * `UPCOMING_DEADLINE`: Compliant, but approaching filing cutoff within the alert window.
   * `INSUFFICIENT_DATA`: Missing entity data or currency/unit mismatch (e.g. rule in `USD`, profile in `INR`). Missing data never passes silently.
6. **Bidirectional Audit Traceability:** Every compliance outcome reconstructs its complete lineage:
   $$\text{Evaluation Result} \longrightarrow \text{Rule Version} \longrightarrow \text{Approved Obligation} \longrightarrow \text{Reviewer Identity} \longrightarrow \text{Verbatim Quote} \longrightarrow \text{Clause} \longrightarrow \text{PDF Page}$$
7. **Amendment Diffing & Impact Analysis:** Evaluates two circular versions clause-by-clause, distinguishing actual textual changes from cosmetic renumbering. Automatically highlights all active rules and historical baselines impacted by the amendment.
8. **Isolated What-If Simulation Sandbox:** Allows compliance managers to clone entity profiles and test hypothetical balance sheet allocations. Simulations are strictly flagged (`is_simulation: true`) and never contaminate production dashboards or audit logs.
9. **Contradiction & Conflict Detection:** Flags overlapping regulatory requirements across multiple circulars that specify differing thresholds.
10. **Append-Only Audit Log:** Database-level PostgreSQL triggers reject `UPDATE` and `DELETE` operations on the audit ledger.

---

## 3. Technology Stack & Design System

| Layer | Technologies | Hosting |
|---|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, React Router 7 | Vercel |
| **Backend API** | Node.js 22, Express 5, Prisma ORM 6, TypeScript 5.9 | Render |
| **AI Microservice** | Python 3.11, FastAPI, PyMuPDF, Google Gemini API | Render |
| **Database** | PostgreSQL on Neon (Serverless with branch isolation) | Neon |

### Visual Design System
ClauseTrace features a dedicated FinTech/RegTech design system with modern typography and alpha-transparent illustrations:

* **Brand Color Palette:**
  * `#2C3531` — Deep Pine Charcoal (Headings, primary text, high-contrast badges)
  * `#116466` — Deep Sea Teal (Primary brand, main CTAs, active navigation, pass status)
  * `#D9B08C` — Warm Golden Sand (Accent cards, warning badges, upcoming deadlines)
  * `#FFCB9A` — Soft Apricot Peach (Tags, secondary highlights, warm indicators)
  * `#D1E8E2` — Pale Sage Mint (Borders, card backgrounds, hover states, surface tint)
* **Typography:**
  * **UI & Body:** *Plus Jakarta Sans* (Weights 300 to 800)
  * **Brand & Display:** *Space Grotesk*
* **Thematic Assets:** Custom 3D RegTech transparent isometric artwork (`/images/hero-regtech.png`) and vector emblem (`/logo.svg`).

---

## 4. User Roles & Governance (RBAC)

| Role | Permissions |
|---|---|
| **Viewer** | Read-only access to circulars, clauses, approved obligations, versioned rules, entity profiles, and dashboards. |
| **Reviewer** | All Viewer rights, plus: upload circulars, trigger AI extraction, approve/edit/reject obligations, compile rules, execute evaluations, compare circular versions, flag conflicts, and inspect audit logs. |
| **Admin** | All Reviewer rights, plus: manage user accounts, deactivate users, and adjust risk scoring weights. |

*Self-service registration via `/signup` grants instant **Reviewer** access to explore the complete platform.*

---

## 5. Screen Suite

* **Overview Dashboard (`/`):** Real-time compliance health, evaluation distributions, risk-ordered issues, and AI review progress.
* **Document Explorer (`/documents`, `/documents/:id`):** PDF viewer synchronized with parsed clause hierarchy.
* **Review Queue (`/review`, `/obligations/:id`):** Triage proposed obligations, view highlighted quotes, and approve or edit.
* **Rule Manager (`/rules`):** View immutable compiled rule definitions and compilation summaries.
* **Entity Profiler & Evaluator (`/profiles`):** Inspect FME balance sheets, execute deterministic evaluations, and launch What-If scenarios.
* **Regulatory Compare (`/documents/:id/compare`):** Side-by-side circular version comparison with downstream impact analysis.
* **Audit Trail (`/audit`):** Cryptographic log of all logins, extractions, reviews, and rule compilations.
* **User Profile & Credentials (`/profile`):** Account settings, full name editing, password changes, and governance role inspector.
* **Authentication (`/login`, `/signup`):** Branded split-screen access console with credentials verification.

---

## 6. Local Setup & Installation

### Prerequisites
* Node.js 22+
* Python 3.11+
* [uv](https://docs.astral.sh/uv/) package manager
* Neon database account or local PostgreSQL instance

### 1. Repository Setup
```bash
git clone https://github.com/malika-build23/ClauseTrace.git
cd ClauseTrace
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run build         # Generates Prisma client & compiles TypeScript
npm run dev           # Starts API server on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run build         # Validates typecheck and bundles Vite assets
npm run dev           # Starts development UI on http://localhost:5173
```

### 4. AI Service Setup
```bash
cd ../ai-service
uv venv
uv pip install -r requirements-dev.txt

# Start FastAPI microservice on http://localhost:8000
GEMINI_API_KEY=<your-key> AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000
```

---

## 7. Testing & Quality Assurance

```bash
# Backend test suite (90 unit tests: 100-run determinism test, compiler, diffing, auth)
npm --prefix backend test

# AI Service test suite (39 tests: PDF parsing, quote checks, multiplier parsing)
cd ai-service && uv run pytest

# Frontend build & linting verification
npm --prefix frontend run build
```

---

## 8. Authors & Grand Challenge Context

* **Malika** — Co-Architect, Product & AI Extraction Lead
* **Harsh** — Co-Architect, Backend, Rule Engine & DevOps Lead

Built for the **GIFT FutureLab Grand Challenge**, ClauseTrace demonstrates how regulated financial entities and supervisory bodies can deploy generative AI safely: leveraging LLMs where they excel (rapid parsing and structured extraction proposals) while anchoring compliance decisions where they belong (human expertise, pure mathematical determinism, and tamper-proof audit trails).
