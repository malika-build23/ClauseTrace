---
title: ClauseTrace AI Service
emoji: 📄
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# ClauseTrace AI Service

FastAPI service for PDF parsing and obligation extraction. Deployed as a Docker Space on Hugging Face.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| GET | `/health/secure` | `X-Service-Token` | Verifies the backend's shared token |

## Secrets (Space settings)

- `AI_SERVICE_TOKEN`: shared secret; the backend sends it in the `X-Service-Token` header
- `GEMINI_API_KEY`: LLM key (used from Block D onwards)

## Local development

```bash
uv venv && uv pip install -r requirements-dev.txt
AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run ruff check .
```
