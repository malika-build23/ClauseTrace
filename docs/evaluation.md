# ClauseTrace Evaluation (Block L)

Real numbers only. Where a test was not run, or was run in a way that limits what it shows, this file says so.

Measured on 2026-11-20 against the live deployment and a development copy of its database. Every check below can be re-run with the command shown.

## Summary

| Area | What was measured | Result | Strength of evidence |
|---|---|---|---|
| Rule engine | Unit tests, incl. 100-run repeatability | 29 evaluator + 11 compiler tests pass; identical output on 100 repeats | Strong (automated, deterministic) |
| Traceability | Does each obligation's quote appear on the PDF page it cites? | 74 / 74 found: 69 on the cited page, 5 on the next page (clause runs across a page break), 0 missing | Strong (automated, on live data) |
| Change detection | Known-answer test: amended copy with 4 planted changes | 4 / 4 found (2 modified, 1 removed, 1 added), 0 false changes, 8 renumbered clauses correctly "unchanged" | Medium (one synthetic amendment) |
| Extraction quality | Precision / recall against gold labels | 24/24 matched, 5/5 thresholds, **but the labels are a draft written after seeing the model output** | **Weak: not an independent measurement** |
| Human review | Approval / edit / reject rates | **Not measured**: no real reviewer has reviewed production obligations yet | None yet |
| Permissions | Every role against every protected endpoint | 33 / 33 on development, 21 / 21 read-only on production | Strong (automated) |

## 1. Extraction quality

**Status: not yet properly measured.**

- Tooling: [`scripts/evaluate_extraction.py`](../scripts/evaluate_extraction.py) computes precision, recall, F1 and threshold accuracy against a gold-label file.
- Gold file: [`data/gold-labels/angel-funds-2022.json`](../data/gold-labels/angel-funds-2022.json) covers 24 required obligations across 24 clauses of the Angel Funds circular, plus borderline "optional" items.
- **Limitation:** the gold file is a draft, written with AI assistance *after* looking at what the model extracted. Agreement with it is therefore expected and proves little.

Run against production on 2026-11-20 (Angel Funds circular, version 1):

```
TP=24 FP=0 FN=0  precision=1.00 recall=1.00 F1=1.00
Threshold accuracy: 5/5
```

**Do not quote these figures as accuracy.** To get a real measurement:

1. Two team members label the clauses independently, without looking at the model output.
2. Reconcile disagreements and record the agreement rate.
3. Replace the draft file and re-run the script.
4. Extend to the ESG and scheme-filing circulars, which are more principle-based and harder.

Observations from reading the 74 production proposals (informal, not a metric):
- Every numeric limit in the Angel Funds circular was captured with the compliant direction.
- The principle-based ESG circular produced no invented thresholds, and 20 of its 30 proposals were flagged as ambiguous.
- No proposal failed the exact-quote check in production. In development, a paraphrased quote and a wrong threshold were rejected by the checks and retried, as designed.

## 2. Traceability

Run: `uv run --no-project python ../scripts/evaluate_traceability.py <api-url>` (from `ai-service/`).

```
Obligations checked: 74 across 3 document version(s)
Quote on the cited page: 69
Quote on the next page (clause continues across a page break): 5
Quote not found near the cited page: 0
```

Each evaluation result also stores the rule version, the inputs used, the evaluation date, and the obligation key, version and quote. It also stores the document, document version, clause and page; [`scripts/check-review-rules.mjs`](../scripts/check-review-rules.mjs) checks these fields on stored results.

## 3. Change detection

[`scripts/make_test_amendment.py`](../scripts/make_test_amendment.py) builds a clearly stamped TEST copy of the Angel Funds circular with known changes:
- clause 14: 200 → 250 investors;
- clause 18: USD 1,000,000 → USD 1,500,000;
- clause 21 removed, and later clauses renumbered;
- a new clause 24 with a deadline.

[`scripts/check-version-compare.mjs`](../scripts/check-version-compare.mjs) checks the result against that answer.

Final result: 4 / 4 changes found, no false changes. The 8 renumbered clauses (old 22–24, including 22's sub-clauses) were correctly treated as unchanged.

It did **not** pass first time. Earlier runs reported false "modified" clauses, caused by two problems that are now fixed:
- a parser bug that joined hyphenated words across line breaks ("closeended");
- curly vs straight apostrophes counting as differences.

This is one synthetic amendment. Real amendments, with tables, annexures and reworded clauses, have not been tested.

## 4. Rule engine reliability

`cd backend && npm test`: 90 backend tests pass. They include:
- 29 evaluator tests: every operator, boundaries, missing and null data, units, deadlines and windows, rule versions, and 100 identical repeated runs;
- 11 compiler tests;
- 7 conflict, 9 scoring and 12 version-diff tests.

The engine is pure code with no AI. Missing data or a unit mismatch always gives INSUFFICIENT_DATA, never a silent pass or fail.

## 5. Human review statistics

**Not measured.** Production has 74 proposed obligations and no human reviews yet. The review workflow was exercised only by test scripts on a development copy, and those numbers say nothing about real reviewer behaviour. Approval, edit and rejection rates should be reported after the team reviews the three circulars.

## 6. Not tested

- Scanned PDFs (there is no OCR).
- Circulars whose obligations sit in tables.
- Documents other than IFSCA circulars for Fund Management Entities.
- Load and concurrency.
- Any real (non-fictional) entity data.
- Use by compliance professionals.
