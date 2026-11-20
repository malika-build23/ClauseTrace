# ClauseTrace
#by Malika and Harsh

**AI reads. Humans verify. Deterministic rules evaluate. Every result remains traceable.**

ClauseTrace is an AI-assisted, human-verified regulatory compliance platform. It turns financial regulations (starting with public IFSCA circulars) into traceable, structured, machine-checkable obligations.

> **Current stage:** foundation only. The monorepo, database schema, seed data and service skeletons are in place (implementation plan Blocks A–B). Parsing, extraction, review, rules and dashboards are not built yet. No accuracy or validation claims are made. All entity data and thresholds are fictional and illustrative.

## Plans

- [Implementation plan](ClauseTrace_Implementation_Plan.md): what gets built, blocks A–L
- [Execution and deployment plan](ClauseTrace_Execution_and_Deployment_Plan.md): build order and free hosting

## Architecture

| Part | Stack | Hosting (free tier) |
|---|---|---|
| `frontend/` | React, Vite, Tailwind | Vercel |
| `backend/` | Node.js, Express, Prisma | Render |
| `ai-service/` | Python, FastAPI, PyMuPDF | Hugging Face Spaces (Docker) |
| Database | PostgreSQL | Neon |

## Local setup

Requirements: Node 22+, Python 3.11, [uv](https://docs.astral.sh/uv/), the Neon CLI (`npm i -g neon`).

```bash
# 1. Database connection (writes .env.local, git-ignored)
neon login
neon env pull

# 2. Seed passwords: create .env.seed.local (git-ignored) with
#    SEED_ADMIN_PASSWORD, SEED_REVIEWER_PASSWORD, SEED_VIEWER_PASSWORD (12+ chars each)

# 3. Backend
cd backend && npm install
npm run db:migrate      # apply migrations (direct connection)
npm run db:seed         # demo org, users, fictional profiles
npm run db:verify       # check document -> clause -> obligation chain
npm run dev             # http://localhost:4000/api/health

# 4. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173

# 5. AI service (new terminal)
cd ai-service && uv venv && uv pip install -r requirements-dev.txt
AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000
```

Environment variables are listed in [.env.example](.env.example).

## Tests

```bash
cd backend && npm test                       # schema validation tests
cd ai-service && uv run pytest && uv run ruff check .
```

CI runs lint, build and tests for all three parts on every push and pull request.

## Known limitations

- Free hosting sleeps when idle: the first request after a pause can take up to a minute.
- Only fictional entity data is used. Thresholds are illustrative, not real IFSCA figures.
