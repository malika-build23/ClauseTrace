# ClauseTrace
#by Malika and Harsh

**AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.**

ClauseTrace is an AI-assisted, human-verified regulatory compliance platform. It turns financial regulations (starting with public IFSCA circulars) into traceable, structured, machine-checkable obligations.

> **Live:** https://clausetrace-eight.vercel.app
>
> **Current stage:** Blocks A–E of the implementation plan. Sign-in with roles (viewer, reviewer, admin), PDF upload, clause parsing, and AI obligation extraction (Gemini, with exact-quote and number checks) work. Extracted obligations are *proposed* only: human review (Block G), rules and dashboards are not built yet. Parsing and extraction were checked by hand ([parsing notes](docs/parsing-notes.md), [extraction notes](docs/extraction-notes.md)); no accuracy figures are claimed. All entity data and thresholds are fictional and illustrative.

## Plans

- [Implementation plan](ClauseTrace_Implementation_Plan.md): what gets built, blocks A–L
- [Execution and deployment plan](ClauseTrace_Execution_and_Deployment_Plan.md): build order and free hosting

## Architecture

| Part | Stack | Hosting (free tier) |
|---|---|---|
| `frontend/` | React, Vite, Tailwind | Vercel |
| `backend/` | Node.js, Express, Prisma | Render |
| `ai-service/` | Python, FastAPI, PyMuPDF | Render |
| Database | PostgreSQL | Neon |

## Local setup

Requirements: Node 22+, Python 3.11, [uv](https://docs.astral.sh/uv/), the Neon CLI (`npm i -g neon`).

```bash
# 1. Production connection (writes .env.local, git-ignored). Used for migrations and seed.
neon login
neon env pull

# 2. Local development uses a Neon branch, so test uploads never touch production.
#    Create .env.dev.local (git-ignored) with:
#      DATABASE_URL=<neon connection-string dev-local --pooled>
#      DATABASE_URL_UNPOOLED=<neon connection-string dev-local>
#      AI_SERVICE_URL=http://localhost:8000
#      AI_SERVICE_TOKEN=dev-token
#      JWT_SECRET=<any random string of 32+ characters>
neon branches create --name dev-local --no-secrets

# 3. Seed passwords: create .env.seed.local (git-ignored) with
#    SEED_ADMIN_PASSWORD, SEED_REVIEWER_PASSWORD, SEED_VIEWER_PASSWORD (12+ chars each)

# 4. Backend
cd backend && npm install
npm run db:migrate      # apply migrations to production (direct connection)
npm run db:seed         # demo org, admin/reviewer/viewer users, fictional profiles
npm run db:verify       # check document -> clause -> obligation chain
npm run db:audit        # show the latest audit log entries
npm run dev             # http://localhost:4000, uses .env.dev.local

# 5. AI service (new terminal)
cd ai-service && uv venv && uv pip install -r requirements-dev.txt
GEMINI_API_KEY=<your key> AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000

# 6. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Environment variables are listed in [.env.example](.env.example).

## API (so far)

Every endpoint except health and login needs `Authorization: Bearer <token>`. Reading needs any role; uploading, re-parsing and extraction need **reviewer**; user management needs **admin** (admin includes reviewer rights).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health`, `/api/health/ai` | Database and AI-service checks (public) |
| POST | `/api/auth/login` | Sign in (`{ email, password }`), returns an 8-hour Bearer token (public) |
| GET | `/api/auth/me` | The signed-in user |
| GET/POST | `/api/users` | List or create users (admin) |
| PATCH | `/api/users/:id` | Change role, deactivate or reset password (admin) |
| POST | `/api/documents` | Upload a PDF (`file`, optional `title`), or a new version (`documentId`) |
| GET | `/api/documents` | List documents with versions |
| GET | `/api/documents/:id` | Document details |
| GET | `/api/documents/:id/clauses?version=N` | Clauses of a version (latest by default) |
| GET | `/api/documents/:id/versions/:n/file` | Original PDF |
| POST | `/api/documents/:id/versions/:n/parse` | Retry parsing |
| POST | `/api/documents/:id/extract` | Start AI extraction for a version (`{ versionNo? }`), runs in the background |
| GET | `/api/documents/:id/extraction?version=N` | Latest extraction run: progress, counts, rejections |
| GET | `/api/documents/:id/obligations?version=N` | Obligations of a version, in clause order |
| GET | `/api/obligations?status=&documentId=&ambiguous=` | Obligations, ambiguous and low-confidence first |

## Tests

```bash
cd backend && npm test                       # schema and clause-tree tests
cd ai-service && uv run python ../scripts/parse_report.py ../data/raw-pdfs/*.pdf   # parser spot-check
cd ai-service && uv run pytest && uv run ruff check .
# API permissions for every role (creates and deactivates a temporary user; add --read-only for production)
npx dotenv -e .env.seed.local -- node scripts/check-permissions.mjs http://localhost:4000 <document-id>
```

CI runs lint, build and tests for all three parts on every push and pull request.

## Known limitations

- Free hosting sleeps when idle: the first request after a pause can take up to a minute.
- Only fictional entity data is used. Thresholds are illustrative, not real IFSCA figures.
- Sign-in tokens are kept in the browser's localStorage and sent as a Bearer header, because the frontend and API are on different sites and third-party cookies are increasingly blocked. Tokens expire after 8 hours; role changes and deactivation apply immediately.
- Login is rate-limited to 10 attempts per 15 minutes per IP. There is no self-service sign-up or password reset: an admin creates accounts and resets passwords.
- Parser limits (headings, tables, annexures, scanned PDFs) are listed in [docs/parsing-notes.md](docs/parsing-notes.md).
- Extraction uses the Gemini free tier: a document can take several minutes, and limits are listed in [docs/extraction-notes.md](docs/extraction-notes.md).
