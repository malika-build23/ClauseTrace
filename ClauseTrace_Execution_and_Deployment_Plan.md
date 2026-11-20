# ClauseTrace 2.0: Execution and Free Deployment Plan

This plan turns [ClauseTrace_Implementation_Plan.md](ClauseTrace_Implementation_Plan.md) (blocks A–L) into a concrete execution run and puts the result live on **free-tier hosting only**, with source on GitHub and automatic deploys from `main`.

---

## 1. Target Architecture (all free tier)

| Component | Tech | Host (free) | Notes |
|---|---|---|---|
| Frontend | React + Vite + Tailwind | **Vercel** (Hobby) | Static build, auto-deploy on push, preview URLs per PR |
| Backend API | Node.js + Express + Prisma | **Render** (Free Web Service) | Sleeps after ~15 min idle; first request has a cold start |
| AI service | Python + FastAPI + PyMuPDF | **Render** (second Free Web Service) | Native Python runtime; sleeps when idle like the backend |
| Database | PostgreSQL | **Neon** (Free) | Serverless Postgres, works with Prisma; does not expire |
| PDF storage | PostgreSQL `bytea` column | Neon | Avoids another account; PDFs are few and small. Swap to Cloudflare R2 (10 GB free) if storage grows |
| LLM | Gemini API | **Google AI Studio** (free tier) | Rate-limited; all outputs cached by clause hash |
| CI | GitHub Actions | **GitHub** | Lint, tests, build on every push/PR |
| Source | Git | **GitHub** `ClauseTrace` repository | `main` = production |

**Why this split:** Hugging Face now requires a PRO subscription for Docker Spaces on free CPU (checked November 2026), so the AI service runs as a second Render free web service. Render's free instance hours are shared across a workspace (750 h/month), but sleeping services use no hours, so two mostly idle services fit. Render's free Postgres expires after 30 days, so the database lives on Neon instead. Both Render services and Neon sit in Singapore to keep latency low.

**Known free-tier limits (state them in the README):**
- Backend and AI service cold-start after idle (roughly 30–60 s). Open the app a few minutes before any demo.
- Gemini free tier is rate-limited. Extraction runs in a slow async loop with backoff, and cached outputs are used whenever present.
- Neon free has a small storage cap (about 0.5 GB). Enough for the narrow slice.

---

## 2. Repository Layout (monorepo)

```text
ClauseTrace/
├── README.md
├── ClauseTrace_Implementation_Plan.md
├── ClauseTrace_Execution_and_Deployment_Plan.md
├── .gitignore
├── .env.example
├── docker-compose.yml            # local Postgres only
├── .github/workflows/ci.yml
├── docs/
├── data/                         # raw-pdfs, gold-labels, sample-entities, llm-cache
├── frontend/                     # Vercel root directory
├── backend/                      # Render root directory (includes prisma/)
├── ai-service/                   # Render Python service (Dockerfile kept for portability)
├── rule-engine/                  # TypeScript package, imported by backend
└── scripts/                      # eval scripts, seed helpers, HF sync script
```

---

## 3. Execution Run

Each step ends with a commit to `main` (or a short-lived branch merged into `main`) only after its "Done when" check from the implementation plan passes. CI must be green before moving on.

| Step | Implementation block | Deliverable | Deploy effect |
|---|---|---|---|
| 1 | **A** Setup | Monorepo skeleton, hello-world in all 3 services, CI workflow, `.env.example`, `.gitignore` | First deploy of all 3 services (hello world) to verify the pipeline early |
| 2 | **B** Schema + DB | Prisma schema (all tables), first migration, seed script, Zod + Pydantic schemas | Neon database migrated and seeded |
| 3 | **C** Parsing + ingestion | `/parse`, upload API, upload page, clause view | Upload works on the live site |
| 4 | **D** Extraction | `/extract`, validation chain, LLM cache, extraction trigger | Proposed obligations visible live |
| 5 | **E** Auth | JWT, bcrypt, `requireRole`, login, protected routes | Live site requires login |
| 6 | **F** Rule engine | Tests first, compiler, evaluator, evaluation API | CI runs rule-engine tests on every push |
| 7 | **G** Review + profiles + dashboard | Review queue, split-screen review, profiles, dashboard | **Core checkpoint:** full flow works live |
| 8 | **H** Versions + impact | Compare API, diff view, impact items | Amended document flow live |
| 9 | **I** Audit | Audit service, audit UI, historical view | Any result explainable live |
| 10 | **J** Confidence, graph, risk | Review priority, graph view, risk config | Live |
| 11 | **K** Conflicts, simulator | Conflict flags, what-if simulator | Live, simulations excluded from dashboard |
| 12 | **L** Evaluation + demo | Metrics in `docs/evaluation.md`, demo seed data, README, backup video | Final release tagged `v1.0.0` |

**Rule:** deploy from step 1. A pipeline proven on hello-world avoids a deploy surprise at the end.

---

## 4. One-Time Account and Service Setup

All accounts use the free plan. No credit card is required for Vercel, Neon, Google AI Studio, or GitHub. Render may ask for a card for some features; the free web service does not need one.

### 4.1 GitHub
1. Create the `ClauseTrace` repository (public gives unlimited Actions minutes; private gives 2,000 min/month).
2. Push the monorepo. Protect `main`: require CI to pass before merge.

### 4.2 Neon (database)
1. Create a project and a database `clausetrace`.
2. Run `neon env pull`: it writes the **pooled** URL (`DATABASE_URL`) and the **direct** URL (`DATABASE_URL_UNPOOLED`, used by Prisma migrations) to `.env.local`.
3. In `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DATABASE_URL_UNPOOLED")
   }
   ```

### 4.3 Google AI Studio (LLM)
1. Create a Gemini API key.
2. Store it only as `GEMINI_API_KEY` on the Render AI service. Never commit it.

### 4.4 Render (backend and AI service)
Both services are defined in [render.yaml](render.yaml) (free plan, Singapore region, same as Neon).

**clausetrace-api** (root `backend`)
- Build: `npm ci --include=dev && npm run build`
- Start: `npx prisma migrate deploy && npm start`
- Health check: `/api/health`
- Env: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `CORS_ORIGIN` (the Vercel URL), `NODE_ENV=production`

**clausetrace-ai** (root `ai-service`)
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`
- Env: `GEMINI_API_KEY`, `AI_SERVICE_TOKEN` (shared secret the backend sends in the `X-Service-Token` header, so the public URL cannot be used by anyone else)

Both services are linked by public repo URL because the repository belongs to another GitHub account, so pushes do **not** trigger deploys. Deploy with **Manual Deploy** in the Render dashboard (or the Render API) after each push, until the repo owner connects Render's GitHub app. The Vercel frontend is in the same position and is deployed with `vercel deploy --prod` from `frontend/`.

### 4.6 Vercel (frontend)
1. Import the GitHub repo, root directory `frontend`, framework preset **Vite**.
2. Environment variable: `VITE_API_URL` = the Render backend URL.
3. Add `frontend/vercel.json` with an SPA rewrite so client-side routes do not 404:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Every PR gets a preview URL; `main` deploys to production.

---

## 5. CI/CD Workflow (`.github/workflows/ci.yml`)

Jobs, run on every push and pull request:

1. **frontend:** `npm ci`, lint, type-check, `npm run build`
2. **backend + rule-engine:** `npm ci`, lint, `prisma validate`, unit tests (rule engine incl. 100-run repeatability test), build
3. **ai-service:** `pip install`, `ruff`, `pytest` (parser and validation tests use fixture PDFs and a mocked LLM, so CI never calls Gemini)
The ai-service job also checks that its Docker image builds, so the service can move to any container host later.

Vercel and Render deploy themselves from their GitHub integrations, so they need no deploy job. Turn on Render's "wait for CI checks" option so a red build never deploys.

---

## 6. Security and Data Rules for a Public Deployment

- **Secrets:** only in platform env settings and GitHub secrets. `.env` is git-ignored; `.env.example` holds names only.
- **Demo accounts:** seed `admin`, `reviewer`, and `viewer` users with passwords set from env variables at seed time, not hard-coded in the repo.
- **Public sign-up:** off. Only an admin creates users.
- **Upload limits:** PDF only, max size (e.g. 10 MB), MIME and magic-byte check.
- **Rate limiting:** `express-rate-limit` on login, upload, and extraction to protect the free Gemini quota.
- **CORS:** allow only the Vercel production and preview domains.
- **AI service:** rejects requests without the `AI_SERVICE_TOKEN` header.
- **Data:** only public IFSCA documents and fictional entity data. The UI labels illustrative thresholds and simulations clearly.

---

## 7. Demo Reliability on Free Hosting

- Commit cached LLM outputs for the demo documents to `data/llm-cache/` and load them in the seed, so the demo never depends on Gemini availability.
- Open the live site 5 minutes before presenting so both Render services wake up.
- Keep the backup video from Block L.
- Show a "Waking up the server…" state in the frontend when the first API call is slow, so a cold start does not look like a failure.

---

## 8. Go-Live Checklist

- [ ] GitHub `ClauseTrace` repo created; monorepo pushed; `main` protected by CI
- [ ] Neon database created; `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set on Render
- [ ] Gemini API key stored on the Render AI service
- [ ] Render AI service deployed; `/health/secure` returns OK with the token header
- [ ] Render backend deployed; `/api/health` returns OK; migrations applied
- [ ] Vercel frontend deployed; `VITE_API_URL` points to Render; SPA rewrite works
- [ ] CORS limited to the Vercel domains
- [ ] Seed run with demo users (passwords from env) and fictional profiles
- [ ] End-to-end flow passes on the live URLs: upload → extract → review → evaluate → dashboard → compare → audit
- [ ] README lists the live URL, architecture, setup steps, free-tier limits, and honest current stage
- [ ] Release tagged `v1.0.0`

---

## 9. Cost

| Item | Monthly cost |
|---|---|
| Vercel Hobby | $0 |
| Render Free Web Services (2) | $0 |
| Neon Free | $0 |
| Gemini API free tier | $0 |
| GitHub + Actions | $0 |
| **Total** | **$0** |

Free-tier terms change over time. Re-check each provider's current limits when setting up the accounts.
