# ClauseTrace AI Service

FastAPI service for PDF parsing and obligation extraction. Deployed as a free Render web service (see [render.yaml](../render.yaml)). The `Dockerfile` is kept so the service can move to any container host.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| GET | `/health/secure` | `X-Service-Token` | Verifies the backend's shared token |

## Environment (Render service settings)

- `AI_SERVICE_TOKEN`: shared secret; the backend sends it in the `X-Service-Token` header
- `GEMINI_API_KEY`: LLM key (used from Block D onwards)

## Local development

```bash
uv venv && uv pip install -r requirements-dev.txt
AI_SERVICE_TOKEN=dev-token uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run ruff check .
```
