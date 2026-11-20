"""ClauseTrace AI service: PDF parsing and obligation extraction."""

import os
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException

app = FastAPI(title="ClauseTrace AI Service", version="0.1.0")


def require_service_token(x_service_token: str | None = Header(default=None)) -> None:
    """Reject callers that do not send the shared AI_SERVICE_TOKEN.

    The Hugging Face Space URL is public, so only the backend (which knows the
    token) may use the parsing and extraction endpoints.
    """
    expected = os.environ.get("AI_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="AI_SERVICE_TOKEN is not configured")
    if not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="invalid service token")


@app.get("/health")
def health() -> dict[str, str]:
    """Public liveness check (used to wake the Space and by monitoring)."""
    return {"status": "ok"}


@app.get("/health/secure", dependencies=[Depends(require_service_token)])
def health_secure() -> dict[str, str]:
    """Token-protected check, lets the backend verify its token is accepted."""
    return {"status": "ok", "auth": "accepted"}
