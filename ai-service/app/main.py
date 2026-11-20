"""ClauseTrace AI service: PDF parsing and obligation extraction."""

import os
import secrets
from dataclasses import asdict

import pymupdf
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from app.parser import parse_pdf

MAX_PDF_BYTES = 10 * 1024 * 1024

app = FastAPI(title="ClauseTrace AI Service", version="0.2.0")


def require_service_token(x_service_token: str | None = Header(default=None)) -> None:
    """Reject callers that do not send the shared AI_SERVICE_TOKEN.

    The service URL is public, so only the backend (which knows the token)
    may use the parsing and extraction endpoints.
    """
    expected = os.environ.get("AI_SERVICE_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="AI_SERVICE_TOKEN is not configured")
    if not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="invalid service token")


@app.get("/health")
def health() -> dict[str, str]:
    """Public liveness check (used to wake the service and by monitoring)."""
    return {"status": "ok"}


@app.get("/health/secure", dependencies=[Depends(require_service_token)])
def health_secure() -> dict[str, str]:
    """Token-protected check, lets the backend verify its token is accepted."""
    return {"status": "ok", "auth": "accepted"}


@app.post("/parse", dependencies=[Depends(require_service_token)])
async def parse(file: UploadFile = File(...)) -> dict:
    """Split a PDF into clauses: [{clause_number, page, text, parent, level, position}]."""
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF larger than 10 MB")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="file is not a PDF")
    try:
        result = parse_pdf(data)
    except (pymupdf.FileDataError, RuntimeError) as err:
        raise HTTPException(status_code=422, detail=f"PDF could not be read: {err}") from err
    return asdict(result)
