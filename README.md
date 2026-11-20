# ClauseTrace

[![Status](https://img.shields.io/badge/Status-Live%20Prototype-116466?style=for-the-badge)](https://clausetrace-eight.vercel.app)
[![Domain](https://img.shields.io/badge/Domain-RegTech%20%26%20Compliance-D9B08C?style=for-the-badge)](https://clausetrace-eight.vercel.app)
[![Jurisdiction](https://img.shields.io/badge/Jurisdiction-IFSCA%20%7C%20GIFT%20City-2C3531?style=for-the-badge)](https://clausetrace-eight.vercel.app)

> **"AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable."**

**ClauseTrace** is an enterprise-grade Regulatory Technology (**RegTech**) platform that bridges the gap between complex financial regulatory circulars and automated, auditable compliance checking.

Purpose-built for the regulatory framework of the **International Financial Services Centres Authority (IFSCA)** governing Fund Management Entities (**FMEs**) in **GIFT City IFSC**, ClauseTrace converts dense circulars into machine-executable rules—without ever relying on an LLM to make the final compliance decision.

---

## 🌟 The Core Problem

In high-growth international financial jurisdictions like GIFT City IFSC, regulatory bodies issue high-velocity circulars, amendments, and notifications. Financial institutions and compliance teams face three fundamental challenges:

1. **Information Density & Ambiguity:** Capital limits, leverage ratios, net worth requirements, lock-in intervals, and reporting deadlines are buried deep within nested legal sub-clauses (`4.2(a)(i)`).
2. **The LLM Hallucination Trap:** Generic generative AI chatbots cannot be trusted with financial compliance. They invent non-existent exemptions, miss critical negations, and fail to provide the 100% mathematical consistency required for regulatory audits.
3. **Spreadsheet Fragility:** Manual compliance spreadsheets break when regulations are amended, lack lineage to source circulars, and fail to provide verifiable evidence during regulatory inspections.

---

## 💡 How ClauseTrace Works: The 4-Pillar Pipeline

ClauseTrace replaces manual guesswork and risky "black box" AI with a transparent **4-pillar architecture**:

```
 ┌────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
 │   Regulatory PDF       │ ──►  │    PyMuPDF Parser        │ ──►  │   AI Extraction (LLM)    │
 │   (IFSCA Circular)     │      │   (Nested Hierarchies)   │      │ (Gemini + Code Checks)   │
 └────────────────────────┘      └──────────────────────────┘      └────────────┬─────────────┘
                                                                                │
 ┌────────────────────────┐      ┌──────────────────────────┐                   ▼
 │ Deterministic Engine   │ ◄──  │ Versioned Rule Compiler  │ ◄── [Human-in-the-Loop Review]
 │ (Pure TS: Zero AI)     │      │ (Threshold/Deadline/Req) │     (Approve / Edit / Reject)
 └───────────┬────────────┘      └──────────────────────────┘
             │
             ▼
 ┌────────────────────────┐      ┌──────────────────────────┐
 │ Complete Audit Lineage │ ──►  │ Amendment Diff & Impact  │
 │ (Trigger-Locked DB)    │      │ (Renumbering-Resilient)  │
 └────────────────────────┘      └──────────────────────────┘
```

### 1. AI Reads (Extraction with Strict Code Guardrails)
* Google Gemini parses legal circulars to propose structured obligations (subject, modality, threshold, deadline).
* **Exact Quote Verification:** The system strictly rejects any proposed obligation whose supporting quote does not exist verbatim in the source text.
* **Numeric Cross-Check:** Verifies that extracted figures (accounting for *crore, lakh, million, thousand*) match the verified quote word-for-word.
* **Zero Hallucinated Metadata:** Document numbers, clause paths, and page numbers are injected from database records—never hallucinated by the model.

### 2. Humans Verify (Review Queue)
* Compliance officers triage proposed obligations through a prioritized queue based on risk, ambiguity, and financial impact.
* Reviewers can **Approve**, **Edit** (creating an immutable version increment $v_{n+1}$), or **Reject** with structured feedback.
* Subjective requirements (*"maintain adequate systems"*) can be classified as reference-only guidance, separating them from computable numeric thresholds.

### 3. Deterministic Rules Evaluate (Pure Zero-AI Math)
* Approved obligations are compiled into versioned, executable rules (`threshold`, `deadline`, `required_field`).
* Evaluates entity balance sheet figures using pure TypeScript logic with **100% deterministic repeatability** across 100+ consecutive runs:
  * `PASS`: Fully compliant with regulatory thresholds.
  * `FAIL`: Non-compliant with actionable discrepancy values.
  * `UPCOMING_DEADLINE`: Compliant, but approaching filing cutoff within the alert window.
  * `INSUFFICIENT_DATA`: Missing entity data or currency/unit mismatch. Missing data is never assumed compliant.

### 4. Every Result Remains Traceable (Cryptographic Lineage)
* Every compliance evaluation links backward through the complete provenance chain:
  $$\text{Evaluation Result} \longrightarrow \text{Rule Version} \longrightarrow \text{Approved Obligation} \longrightarrow \text{Reviewer Identity} \longrightarrow \text{Verbatim Quote} \longrightarrow \text{Clause} \longrightarrow \text{PDF Page}$$
* Database-level PostgreSQL triggers reject any `UPDATE` or `DELETE` operations on audit logs, providing a tamper-proof trail for regulatory inspections.

---

## 🚀 Key Platform Features

* 📊 **Executive Overview & Compliance Heatmap Matrix:** Real-time visibility into organizational compliance health. The interactive Compliance Heatmap displays an Entity × Rule matrix with dual-coded status cells (icon + text), risk-weighted sorting, density toggles (`compact`, `normal`, `comfortable`), slide-over explanation drawers, and PNG/CSV audit exports.
* 📑 **PDF Viewer with Synchronized Live Highlights:** High-performance canvas reader (`pdfjs-dist`) that maps extracted obligations directly onto source PDF pages. Uses color-coded modality fills (`MUST`, `MUST NOT`, `SHOULD`, `MAY`), status outlines (`approved`, `proposed`, `rejected`), synchronized clause scrolling, and hover cards without guessing coordinates.
* 🔗 **Animated Traceability Chain (React Flow Lineage):** An interactive provenance flow tracking every compliance result backward across 7 verified stages: Result $\rightarrow$ Rule Version $\rightarrow$ Approved Obligation $\rightarrow$ Human Reviewer $\rightarrow$ Verbatim Quote $\rightarrow$ Document Version $\rightarrow$ Clause & PDF Page. Missing links are explicitly flagged, and the final node opens the live PDF viewer at the exact quote.
* 🔄 **Amendment Diffing & Cascading Blast Radius:** Word-level side-by-side clause comparison between circular versions. Distinguishes substantive modifications from renumbered/moved clauses (`MOVED` badge), enforces strict governance (*"Approved rules do not change automatically. Review required."*), and displays the cascading blast radius (Clause $\rightarrow$ Obligations $\rightarrow$ Rules $\rightarrow$ Evaluations) with direct links to the review queue.
* ⌨️ **Global Command Palette (`Ctrl/Cmd+K`):** Fast keyboard-driven command center powered by `cmdk` indexing regulatory circulars, clauses, obligations, compiled rules, and entities. Enforces strict RBAC: viewer accounts cannot view or navigate to audit trails or user management.
* 🌓 **Accessible Design System & Dark Mode:** Built with a specialized FinTech palette (`#2C3531`, `#116466`, `#D9B08C`, `#FFCB9A`, `#D1E8E2`), high-contrast colour-blind accessible status badges, persistent light/dark theme toggle, a 5-step guided onboarding tour, and Render free-tier cold-start resilience banners.
* ⚖️ **Human-in-the-Loop Review Queue:** Compliance console to inspect extracted obligation candidates, verify supporting source quotes, adjust parameters, and approve obligations before they become enforceable rules.
* ⚙️ **Compiled Rule Manager:** Central registry of versioned, deterministic compliance logic ASTs (`threshold`, `deadline`, `required_field`) executing with 100% mathematical consistency.
* 🏢 **Entity Profiler & What-If Simulation Sandbox:** Real-time compliance runner against fund balance sheets, with isolated simulation sandboxes allowing risk officers to test hypothetical balance sheet allocations without touching production audit trails.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, React Router 7 |
| **Design System** | Dedicated FinTech Palette (`#2C3531`, `#116466`, `#D9B08C`, `#FFCB9A`, `#D1E8E2`), *Plus Jakarta Sans*, *Space Grotesk* |
| **Backend API** | Node.js 22, Express 5, TypeScript, Prisma ORM |
| **AI Extraction Engine** | Python 3.11, FastAPI, PyMuPDF, Google Gemini API |
| **Database & Security** | PostgreSQL on Neon (Serverless with branch isolation), bcrypt, JWT |

---

## 🎯 What Makes ClauseTrace Unique?

| Traditional Compliance | Generic Generative AI | ClauseTrace |
|---|---|---|
| Manual spreadsheet audits taking weeks | Instant answers, but 10–25% hallucination risk | Automated extraction in seconds with 0% hallucinated rules |
| Fragile formulas with no lineage | "Black-box" reasoning impossible to audit | Mathematical determinism with exact PDF page-and-quote lineage |
| Amendments require reading entire circulars from scratch | Cannot reliably isolate subtle text edits from clause renumbering | Automated semantic diffing that maps exact downstream rule impact |
| High cost of regulatory penalties and missed deadlines | Cannot produce legal-grade audit logs | Tamper-proof, trigger-locked PostgreSQL audit trails |

---

### by Team CacheCat
