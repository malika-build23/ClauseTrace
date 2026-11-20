# Clause Parsing: Spot-Check Notes

Block C check of the PDF parser (`ai-service/app/parser/`) against three public IFSCA circulars addressed to Fund Management Entities. Run on 2026-11-20.

Reproduce with:

```bash
cd ai-service
uv run --no-project python ../scripts/parse_report.py ../data/raw-pdfs/*.pdf
```

## Documents

| File | Source | Pages | Status | Clauses |
|---|---|---|---|---|
| `ifsca-esg-disclosures-2023.pdf` | Circular F. No. 756/IFSCA/ESG Schemes/2022-23, 18 Jan 2023 | 8 | parsed | 62 |
| `ifsca-angel-funds-2022.pdf` | Circular F. No. 645/IFSCA/Angel Schemes/2022-23, 1 Jul 2022 | 8 | parsed | 44 |
| `ifsca-scheme-filing-2024.pdf` | Circular F. No. IFSCA-AIF/32/2024-Capital Markets, 5 Apr 2024 | 14 | parsed | 71 |

## Spot-check method

The parsed clause list was compared by hand against the PDFs. The check covered clause number, start page, parent clause, and whether the text started and ended in the right place. This is a manual review by the developer, not a measured accuracy figure.

About 60 clauses were checked across the three documents, more than the 20 the plan asks for. Examples:

| Clause | Expected (from PDF) | Result |
|---|---|---|
| ESG `2(B)(I)(a)` | p. 2, child of `2(B)(I)` | Correct |
| ESG `3(E)` | p. 6, child of `3` | Correct |
| ESG `4(c)` | p. 7, child of `4` | Correct |
| Angel `3(i)`–`3(iv)` | p. 2, roman items under `3` | Correct |
| Angel `7(b)(ii)` | p. 3, child of `7(b)` | Correct |
| Angel `22(v)` | p. 5, child of `22` | Correct |
| Scheme filing `4(c)(iii)` | p. 2, child of `4(c)` | Correct |
| Scheme filing `4(d)(xv)` | p. 2, 15th roman item | Correct |
| Scheme filing `4(i)` after `4(h)` | letter (i), not roman one | Correct |

No wrong clause numbers, start pages or parent links were found in the checked sample. Headers, footers and "Page x of y" lines were removed. Curly quotes are kept as real Unicode characters. Some Windows terminals show them as `?`; that is a console display issue, not a data issue.

## Known weaknesses

1. **Section headings join the previous clause.** A heading line such as "Initial Disclosures for ESG Schemes in Offer Document" between clauses is added to the end of the clause before it (ESG `1(B)`). Obligation extraction (Block D) must not treat this heading as part of the obligation, and quote verification will still pass because the heading is in the stored text.
2. **Tables are flattened.** Table cells are read line by line into the surrounding clause. None of the three test documents depends on a table for an obligation, but some circulars will.
3. **Numbering must start at 1.** If the first numbered clause is not `1.`, no numbered clauses are accepted and the document falls back to paragraph mode (`needs_manual_split`). Excerpts or annexures that start mid-sequence will hit this.
4. **Annexures restart numbering.** A second `1.` (for example in an annexure) is not the expected next number, so it is read as plain text and joins the last clause.
5. **Scanned PDFs are not supported.** There is no OCR. A scanned PDF produces no text and falls back to paragraph mode with empty or missing clauses.
6. **Lettered items need an enclosing numbered clause.** `(a)` before any numbered clause is kept in the preamble.

Items 1, 3 and 4 are the most likely to matter for the next circulars and are candidates for improvement before the evaluation in Block L.
