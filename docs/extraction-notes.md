# Obligation Extraction: How It Works and First Results

Block D of the implementation plan. Gemini proposes obligations; deterministic code decides what is kept. Nothing is approved until a human reviewer acts (Block G).

## Pipeline

1. **Pre-filter (backend, no AI).** Only clauses with obligation wording ("shall", "must", "should", "may", "required", "ensure", …) and at least 25 characters are sent. Definitions and headings are skipped. Clauses that already have obligations are skipped too, so a rerun never touches reviewed obligations.
2. **Cache (backend).** The key is `sha256(prompt version + clause text)`. Only results without rejections are cached, so problem clauses are retried on the next run.
3. **Batching (backend).** Up to 12 clauses or 24,000 characters per request, with a 4 s pause between batches. On HTTP 429 the backend waits as told (at most 120 s, up to 4 times).
4. **Model call (AI service).** Uses Gemini structured JSON output at temperature 0. Models are tried in order `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-3.5-flash`; a busy (503/504), rate-limited (429) or timed-out model falls through to the next. Override with `GEMINI_MODELS`.
5. **Checks (AI service, no AI).**
   - The output must match the schema (Pydantic).
   - The `quote` must appear in the clause text. The comparison ignores case, spacing and quote/dash style; anything else is rejected.
   - A threshold value must appear in the quote. Commas and "million/crore/lakh" are understood.
   - A deadline's year must appear in the quote.
   - `machine_checkable` without a threshold or deadline is downgraded to false.
   - Vague terms ("adequate", "appropriate", "wherever feasible", …) force `ambiguity_flag`.
   - Clauses with rejected output are sent once more. The attempt with fewer rejections is kept.
6. **Source fields come from the database, not the model.** Document, version, clause number and page are filled in from the request, so they cannot be hallucinated.
7. **Second validation (backend).** The AI-service response is validated again with the shared Zod schema before anything is stored.

## Threshold convention

A threshold always describes what a **compliant** value looks like, whatever the modality. For example, "shall not accept less than USD 40,000" gives `commitment_amount >= 40000 USD` with modality `must_not`. Limits made of several values ("2.5% or USD 20,000, whichever is less") get no threshold and are not machine-checkable. This convention was added after a test run returned `< 40000` for that clause, and the rule compiler (Block F) relies on it.

## First run (dev database, 2026-11-20)

Document: Angel Funds circular (IFSCA, 1 Jul 2022), 44 parsed clauses.

| Measure | Value |
|---|---|
| Clauses sent to the model | 27 |
| Clauses skipped by the wording filter | 17 (definitions, sub-conditions of a parent clause) |
| Obligations proposed | 24 |
| Outputs rejected by validation | 0 |
| Models that answered | gemini-3.5-flash-lite, gemini-3.5-flash (fallback) |
| Duration | about 8 minutes (one batch fell back to a slower model) |
| Rerun duration | 5 s (4 clauses from cache, 40 skipped, 0 new) |

The developer read through the 24 proposals. Every numeric limit in the circular was captured with the compliant direction (200 investors, USD 40,000, USD 1,500,000 per investment, 1-year lock-in, USD 1,000,000 corpus, USD 3,000 and USD 500 fees). Vague obligations ("material changes … immediately", "comply with all other conditions") were flagged as ambiguous. This is an informal read-through, **not** a measured precision/recall. That measurement needs the gold-label set from Block L.

## Production run (2026-11-20)

All three uploaded circulars were extracted on the live deployment. Every batch was answered by `gemini-3.5-flash-lite`.

| Document | Clauses sent / skipped | Proposed | Rejected | Machine-checkable | Flagged ambiguous | Time |
|---|---|---|---|---|---|---|
| Angel Funds (2022) | 27 / 17 | 24 | 0 | 7 | 4 | 45 s |
| ESG scheme disclosures (2023) | 33 / 29 | 30 | 0 | 0 | 20 | 45 s |
| Filing of schemes or funds (2024) | 17 / 54 | 20 | 0 | 0 | 4 | 33 s |

The mix matches the documents. The Angel Funds circular has hard numeric limits. The ESG circular calls itself "principle-based": no thresholds were invented, and most of its obligations were flagged as ambiguous. In the scheme-filing circular, most skipped clauses are items of a disclosure list ("Fund Offering;", "Tenure of the Scheme or Fund;"). The obligation itself sits in the parent clause ("the PPM … contains the following minimum disclosures"), so one proposal covers the whole list. A reviewer may want to split it into one obligation per item.

## Known limitations

- **Sub-items lose parent context.** A clause such as `22(ii)` is sent without the text of clause 22, so conditions stated only in the parent are not attached to the child's obligation.
- **The wording filter can miss obligations** phrased without any of the listed words, such as "The FME to file…". Such clauses are skipped silently, but they are still visible in the clause view.
- **Model confidence is self-reported** and was 0.9–1.0 for nearly everything. It is a weak signal; Block J will add a review priority based on the deterministic checks.
- **Free-tier latency varies widely.** The same 6-clause batch took 16 s on one model and timed out on another. Runs happen in the background and can be restarted; finished clauses are not redone.
- **Runs live in the backend process.** If the free Render instance restarts mid-run, the run is marked failed on the next start and can be started again.
