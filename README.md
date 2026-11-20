# ClauseTrace
#by Malika and Harsh

**AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.**

ClauseTrace turns financial regulations into traceable, machine-checkable compliance obligations, with a person in control of every decision. It starts with public IFSCA circulars for Fund Management Entities in GIFT IFSC.

> **Live:** https://clausetrace-eight.vercel.app (sign-in required; the free servers can take up to a minute to wake up)
>
> **Current stage: working prototype.** All twelve blocks of the [implementation plan](ClauseTrace_Implementation_Plan.md) are built and deployed, and the full flow (upload → AI extraction → human review → rules → evaluation → dashboard → amendment impact → audit) works end to end. It has been tested only with public IFSCA circulars and **fictional** entity data. It has **not** been piloted with any institution. Extraction accuracy is **not yet independently measured**; see [docs/evaluation.md](docs/evaluation.md) for what was and was not measured.

## What it does

1. **Parse.** A PDF circular is split into numbered clauses (1., 4.2, (a), (i), A., I., …) with page numbers and parent/child links.
2. **Extract.** Gemini proposes obligations per clause (who, must/must not/should/may, action, condition, threshold, deadline). Code, not the AI, then:
   - rejects any proposal whose quote is not word for word in the clause, or whose numbers or dates are not in the quote;
   - flags vague terms.
   Source references come from the database, never from the model.
3. **Review.** A reviewer approves, edits (creating a new version) or rejects each proposal, in a queue ordered by a transparent review priority. Vague obligations can be approved as "reference only".
4. **Rules.** Approved, machine-checkable obligations compile into versioned rules by fixed templates (threshold, deadline, required field).
5. **Evaluate.** A deterministic engine (no AI) checks entity data and returns PASS, FAIL, UPCOMING_DEADLINE or INSUFFICIENT_DATA, with an explanation and the exact inputs used. Missing data or a unit mismatch never passes silently.
6. **Trace.** Any result opens the chain: result → rule version → approved obligation → reviewer → quote → document version → clause → PDF page.
7. **Amendments.** Two versions are compared clause by clause (renumbering is not a change), and the affected obligations, rules and results are listed for review. Approved rules never change by themselves.
8. **More.**
   - Append-only audit log.
   - Risk-ordered dashboard, with the reasons and weights visible.
   - Knowledge-graph view: "if this clause changes, what is affected?"
   - Conflict flags: same metric, different limits; flagged, never concluded.
   - What-if simulator, kept out of compliance records.

## Architecture

| Part | Stack | Hosting (free tier) |
|---|---|---|
| `frontend/` | React, Vite, Tailwind | Vercel |
| `backend/` | Node.js, Express, Prisma, deterministic rule engine | Render |
| `ai-service/` | Python, FastAPI, PyMuPDF, Gemini | Render |
| Database | PostgreSQL | Neon |

Details: [docs/architecture.md](docs/architecture.md). Demo walkthrough: [docs/demo-script.md](docs/demo-script.md).

## Roles

| Role | Can |
|---|---|
| viewer | Read everything except the audit log and user list |
| reviewer | Also upload, extract, review, compile rules, evaluate, compare versions, flag conflicts, read the audit log |
| admin | Also manage users and risk weights |

Every endpoint except health and sign-in needs `Authorization: Bearer <token>`.

## Local setup

Requirements: Node 22+, Python 3.11, [uv](https://docs.astral.sh/uv/), the Neon CLI (`npm i -g neon`).

```bash
# 1. Production connection (writes .env.local, git-ignored). Used for migrations and seed.
neon login && neon env pull

# 2. Local development uses a Neon branch, so tests never touch production.
neon branches create --name dev-local --no-secrets
#    Create .env.dev.local (git-ignored) with DATABASE_URL / DATABASE_URL_UNPOOLED of that branch
#    (neon connection-string dev-local [--pooled]), AI_SERVICE_URL=http://localhost:8000,
#    AI_SERVICE_TOKEN=dev-token and JWT_SECRET=<32+ random characters>.

# 3. Seed passwords: .env.seed.local (git-ignored) with SEED_ADMIN_PASSWORD,
#    SEED_REVIEWER_PASSWORD and SEED_VIEWER_PASSWORD (12+ characters each).

# 4. Backend
cd backend && npm install
npm run db:migrate      # apply migrations
npm run db:seed         # demo org, admin/reviewer/viewer, fictional entities, cached AI results
npm run dev             # http://localhost:4000 (uses .env.dev.local)

# 5. AI service (new terminal)
cd ai-service && uv venv && uv pip install -r requirements-dev.txt
GEMINI_API_KEY=<key> AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000

# 6. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Environment variables: [.env.example](.env.example).

## Tests and checks

```bash
cd backend && npm test                  # 90 tests: rule engine (incl. 100-run repeatability), compiler, diff, scoring, conflicts, auth
cd ai-service && uv run pytest          # 39 tests: parser, schema, extraction checks with a fake LLM
cd frontend && npm run lint && npm run build

# End-to-end (development database; they write test data):
node --env-file=.env.seed.local scripts/check-permissions.mjs   <api> <document-id>   # add --read-only for production
node --env-file=.env.seed.local scripts/check-review-rules.mjs  <api> <angel-funds-document-id>
node --env-file=.env.seed.local scripts/check-version-compare.mjs <api> <angel-funds-document-id>
node --env-file=.env.seed.local scripts/check-insights.mjs      <api>

# Evaluation (read-only):
python scripts/evaluate_extraction.py <api> <document-id> data/gold-labels/angel-funds-2022.json
cd ai-service && uv run --no-project python ../scripts/evaluate_traceability.py <api>
```

CI runs lint, build and tests for all three parts on every push.

## Known limitations

- **Accuracy:** extraction accuracy is not independently measured yet. The gold labels in `data/gold-labels/` are a draft written after seeing the model output; two people must label independently first.
- **Parser:** headings between clauses join the previous clause, tables are flattened, annexures that restart at "1." are not split, and scanned PDFs (no OCR) are not supported. See [docs/parsing-notes.md](docs/parsing-notes.md).
- **Extraction:** child clauses are sent without their parent's text, and clauses without obligation wording ("shall", "must", …) are skipped. See [docs/extraction-notes.md](docs/extraction-notes.md).
- **Data:** only fictional entity data. Thresholds in the demo come from public circulars, and the amendment is a clearly stamped test copy.
- **Hosting:** free hosting sleeps when idle (up to a minute to wake). Extraction runs inside the backend process; a restart interrupts a run, which can then be started again.
- **Accounts:** an admin creates users; there is no self-service password reset.
- **Sessions:** the sign-in token is kept in the browser and sent as a Bearer header (the frontend and API are on different sites), and expires after 8 hours.
