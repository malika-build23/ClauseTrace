# Demo Script (about 8 minutes)

Live site: https://clausetrace-eight.vercel.app

## Before the demo

- Open the site **5 minutes early**. The free servers sleep when idle and need up to a minute to wake.
- Sign in as the **reviewer** in one browser and as the **viewer** in a private window. Passwords are in `.env.seed.local`.
- The three circulars are already uploaded and extracted.
  - The AI results for them, and for the test amendment, are cached in the database, so no live AI call is needed.
  - If Gemini is unavailable, extraction still works from the cache.
- Have the backup video ready.
- Know where the test amendment is: `data/test-amendments/angel-funds-TEST-amendment.pdf`. It is stamped "TEST COPY – not an IFSCA publication"; say so when you upload it.

## Flow

1. **Overview.** "AI reads, humans verify, deterministic rules evaluate, every result remains traceable." Show the summary cards.
2. **Upload and parse.** On Documents, open the Angel Funds circular. Show clauses with page numbers and nesting, then click a page number to open the PDF at that page.
3. **AI extraction.** Show the obligations under clause 18, with the exact quote highlighted in the clause. Point out that a quote that is not word-for-word in the source is rejected by code, not by the AI.
4. **Human review.** Open Review; the queue is ordered by priority, and the reasons are shown. Then:
   - Clause 18 (corpus ≥ USD 1,000,000): **Approve**.
   - Clause 14 (≤ 200 investors): **Approve**.
   - Clause 17 (lock-in): change the unit from "year" to "years", then **Approve with edits**. This creates version 2; version 1 is kept.
   - Clause 21 (leverage): **Reject** with a comment.
5. **Rules.** On Rules, click **Compile approved obligations**. The rules are fixed templates with no AI, and they are versioned.
6. **Evaluate.** On Entities, open *Beta Angel Fund (fictional)* and click **Evaluate rules**. Show FAIL, and *Alpha* PASS, then *Delta* INSUFFICIENT_DATA: its corpus is in INR, and no currency conversion is guessed.
7. **Explain a result.** Open a FAIL result: result → rule version → approved obligation (who approved it) → exact source text → PDF page.
8. **Amendment.** On the Angel Funds circular, click **New version** and upload the TEST amendment. Then:
   - Click **What changed**: 2 modified, 1 removed, 1 added. Renumbered clauses are not counted as changes.
   - Show the affected obligations and rules. Approved rules did not change by themselves.
   - Click **Extract obligations** on version 2: only the 3 changed or new clauses are sent, and they come from the cache.
9. **Audit.** Open Audit and filter by the corpus obligation: every step is recorded, and the log is append-only.
10. **Optional.**
    - Conflicts → **Scan**: the two fee clauses are flagged. Mark them "not a conflict"; the tool flags, people decide.
    - Entities → **Create what-if copy**: change a value, evaluate, and compare baseline vs scenario. It is marked SIMULATION and never appears on the dashboard.

## Likely jury questions

| Question | Short answer |
|---|---|
| What if the AI hallucinates? | Every proposal must quote the source word for word. Code checks the quote, any numbers and any dates against the clause, and nothing is used until a person approves it. |
| Does it make legal decisions? | No. It proposes, and people approve. Rules only check explicit, approved, measurable conditions; anything vague is flagged and can be approved as reference only. |
| How is this different from a chatbot? | Results are reproducible (deterministic engine), every result is traceable to a clause and page, and changes are versioned and audited. |
| How accurate is it? | Not yet properly measured. Traceability was checked on live data (74/74). Extraction precision/recall needs independent human labels; the method and script are ready. See `docs/evaluation.md`. |
| Data protection? | The demo uses only public circulars and fictional entity data. Real use needs a security review and hosting in India before any non-public data is handled. |
| Business model? | Software for regulated entities and regtech providers (per entity), with a structured obligation register that could also help supervisors. To be validated with users. |
