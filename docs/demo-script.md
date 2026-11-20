# ClauseTrace Live Demo Script (8 Minutes)

**Target Audience:** Compliance Officers, Regulatory Sandbox Evaluators, IFSC RegTech Jury  
**Live Prototype URL:** https://clausetrace-eight.vercel.app  
**Core Thesis:** *"AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable."*

---

## ⏱️ Pre-Demo Checklist (5 Minutes Before)
1. **Wake Up Cold Servers:** Open the live URL 5 minutes prior to warm Render free-tier instances. The UI displays the amber *"Waking up server..."* indicator if spinning up.
2. **Dual-Browser Setup:**
   - **Window 1 (Main / Chrome):** Log in as **Reviewer** (`reviewer@clausetrace.local`).
   - **Window 2 (Incognito):** Log in as **Viewer** (`viewer@clausetrace.local`) to demonstrate strict read-only RBAC.
3. **Data Pre-loaded:** The three core IFSCA FME circulars are pre-extracted in the database with complete deterministic test suites.

---

## 🎬 Minute-by-Minute Walkthrough

### Minute 1: The Core Problem & Design System
* **Action:** Open Dashboard (`/`). Point out the calm, professional FinTech palette (`#2C3531`, `#116466`, `#D9B08C`, `#FFCB9A`, `#D1E8E2`) and toggle between Light and Dark mode using the sun/moon icon.
* **Talk Track:** *"Regulatory compliance in GIFT City cannot rely on black-box LLMs that hallucinate numbers or spreadsheet formulas that break on amendments. ClauseTrace enforces deterministic repeatability with full regulatory lineage."*
* **Feature Highlight:** Point out the **First-Run Guided Tour** (which introduces the navigation flow and remembers dismissal) and the **WakeUpIndicator** that gracefully handles free-tier cold starts.

---

### Minute 2: Executive Compliance Heatmap
* **Action:** On Dashboard, click the **Compliance Heatmap** tab.
* **Talk Track:** *"Compliance officers managing multiple funds need immediate portfolio-level clarity across hundreds of obligations."*
* **Interactive Highlights:**
  1. **Dual-Coded Cells:** Every cell pairs a distinct status icon + text label (colour-blind safe; never color alone).
  2. **Density Switcher:** Toggle between `Compact` (high-density matrix for 100+ columns), `Normal`, and `Comfortable`.
  3. **Risk-Weighted Sorting:** Point out how entities are sorted by composite risk scores with visible priority badges.
  4. **Cell Drawer:** Click on a `FAIL` or `INSUFFICIENT_DATA` cell. A slide-over drawer opens displaying the exact evaluation explanation and the frozen inputs used at evaluation time.
  5. **Export:** Click **Export CSV** or **Export PNG** to demonstrate audit-ready board reporting.

---

### Minute 3: PDF Viewer with Live Text-Layer Highlights
* **Action:** Navigate to **Documents** (`/documents`) and select the *IFSCA Angel Funds Circular*. Click **Split-Screen PDF View**.
* **Talk Track:** *"Every extracted obligation must be anchored to the regulator's exact published text. We never guess coordinates."*
* **Interactive Highlights:**
  1. **Text-Layer Highlighting:** The PDF renders using `pdfjs-dist`. Obligation quotes are matched against the PDF text layer.
  2. **Modality & Status Encoding:**
     - Modality fill colors: Teal for `MUST`, Red for `MUST NOT`, Amber for `SHOULD`, Sky for `MAY`.
     - Status outline patterns: Solid for `approved`, dashed for `proposed`, strike-through for `rejected`.
  3. **Synchronized Scrolling:** Click an extracted obligation on the right; the PDF viewer immediately scrolls to the correct page and flashes the highlight box.
  4. **Interactive Hover Card:** Hover over a highlight in the PDF to preview the obligation card (Subject, Action, Threshold, Deadline).
  5. **Strict Safety Fallback:** Mention that if an OCR text layer cannot locate a quote, the system displays a clear notice rather than hallucinating coordinates.

---

### Minute 4: Human-in-the-Loop Review Queue
* **Action:** Navigate to **Review** (`/review`).
* **Talk Track:** *"Principle 1: AI proposes, code verifies, humans approve. AI text is never treated as a compliance determination."*
* **Interactive Highlights:**
  1. **Priority Ordering:** High-priority items (ambiguous clauses, complex numeric thresholds) appear at the top with explicit priority reasons.
  2. **Side-by-Side PDF Verification:** When inspecting a proposed obligation, the embedded PDF viewer renders the source page side-by-side.
  3. **Actions:**
     - Approve Clause 18 (Corpus $\ge$ USD 1,000,000).
     - Edit Clause 17 (Change unit, creating immutable version $v_2$).
     - Reject non-computable subjective clauses with structured auditor comments.

---

### Minute 5: Deterministic Compilation & Evaluation
* **Action:** Navigate to **Rules** (`/rules`) and click **Compile Approved Obligations**.
* **Talk Track:** *"Notice that compilation uses pure TypeScript AST templates—zero generative AI. Rules are versioned, immutable, and strictly test-backed."*
* **Action:** Navigate to **Entities** (`/profiles`), select *Beta Angel Fund*, and click **Evaluate Rules**.
* **Results Display:**
  - `PASS`: Meets all numeric thresholds.
  - `FAIL`: Capital below minimum statutory requirement with exact numerical deficit.
  - `INSUFFICIENT_DATA`: Missing currency unit or required field. Missing data is never assumed compliant.

---

### Minute 6: Animated Traceability Chain (Lineage Flow)
* **Action:** From an evaluation result, click **View Full Traceability Chain** (`/evaluations/:id`).
* **Talk Track:** *"During an audit inspection, a regulator asks: 'Why did you fail this entity on this date?'"*
* **Interactive Highlights:**
  1. **React Flow Interactive Canvas:** The animated lineage graph traces backward across 7 verified stages:
     $$\text{Result} \longrightarrow \text{Rule Version} \longrightarrow \text{Approved Obligation} \longrightarrow \text{Reviewer Sign-off} \longrightarrow \text{Verbatim Quote} \longrightarrow \text{Document Version} \longrightarrow \text{Clause \& PDF Page}$$
  2. **Animated Pulsing Edges:** Highlight the backward data flow from determination to source circular.
  3. **Missing Provenance Alert:** Explain that if any database record is missing or unverified, a red dashed warning node appears—the UI never fakes a provenance link.
  4. **Direct PDF Jump:** Click **Inspect in Live PDF** on the final node. A slide-over drawer immediately opens the PDF viewer at the exact page with the verbatim quote highlighted.
  5. **Accessible List Toggle:** Switch to the semantic `<ol>` list fallback to demonstrate full screen-reader accessibility.

---

### Minute 7: Amendment Diff with Cascading Blast Radius
* **Action:** Open **Documents**, choose the Angel Funds circular, and navigate to **What Changed** (`/documents/:id/compare`).
* **Talk Track:** *"What happens when the regulator publishes an amendment circular?"*
* **Interactive Highlights:**
  1. **Word-Level Side-by-Side Diff:** Displays the original clause and amended clause side-by-side with deletions struck out in red and additions in emerald green.
  2. **Renumbered / Moved Detection:** Point out that clauses renumbered without text changes are tagged with a distinct blue `MOVED` badge, not falsely marked as modified.
  3. **Governance Callout Banner:**
     > **"Approved rules do not change automatically. Review required."**
     Explain that live rules remain locked to their approved baseline until an authorized reviewer signs off.
  4. **Cascading Blast Radius Animation:** Select a changed clause to reveal the 4-stage impact cascade:
     $$\text{Changed Clause} \longrightarrow N \text{ Obligations} \longrightarrow M \text{ Compiled Rules} \longrightarrow K \text{ Historical Determinations}$$
  5. **Review Queue Links:** Direct links allow compliance teams to jump straight into `/review` to triage affected obligations.

---

### Minute 8: Global Command Palette & Strict RBAC
* **Action:** Press `Ctrl+K` (or `Cmd+K` on Mac) anywhere in the application.
* **Talk Track:** *"Power compliance officers need instant keyboard navigation across thousands of regulatory records."*
* **Interactive Highlights:**
  1. **Unified Search:** Search across documents, clauses, obligations, rules, and entity profiles with debounced results and category icons.
  2. **Strict RBAC Demonstration:**
     - In the **Reviewer** session: Searching reveals system navigation including `/audit`.
     - In the **Viewer** window: Open `Ctrl+K` and show that `/audit` and `/users` are **strictly suppressed**—viewers cannot discover or navigate to restricted audit logs or administration panels.
  3. **Recent Activity:** When the search query is blank, recently visited records are displayed at the top.

---

## 🎯 Wrap-Up Summary Statement
*"ClauseTrace keeps AI to proposing: code checks every quote against the source, a person approves, a deterministic engine evaluates, and every result traces back to the clause and page it came from."*
