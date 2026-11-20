"""ClauseTrace AI service: PDF parsing and obligation extraction."""

import logging
import os
import secrets
from dataclasses import asdict
from functools import lru_cache

import pymupdf
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.extraction import (
    LLM,
    ExtractRequest,
    ExtractResponse,
    GeminiLLM,
    LLMError,
    LLMRateLimited,
    extract,
)
from app.extraction.prompt import PROMPT_VERSION
from app.parser import parse_pdf

MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_BATCH_CHARS = 40_000

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="ClauseTrace AI Service", version="0.3.0")


@lru_cache
def _gemini() -> GeminiLLM:
    return GeminiLLM()


def get_llm() -> LLM:
    """Overridden in tests with a fake model."""
    try:
        return _gemini()
    except LLMError as err:
        raise HTTPException(status_code=503, detail=str(err)) from err


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


@app.get("/extract/info", dependencies=[Depends(require_service_token)])
def extract_info() -> dict[str, str]:
    """Prompt version, used by the backend in its extraction cache key."""
    return {"prompt_version": PROMPT_VERSION}


@app.post("/extract", dependencies=[Depends(require_service_token)], response_model=ExtractResponse)
async def extract_obligations(request: ExtractRequest, llm: LLM = Depends(get_llm)):
    """Propose obligations for up to 20 clauses. Every result is unverified until a human reviews it."""
    if sum(len(c.text) for c in request.clauses) > MAX_BATCH_CHARS:
        raise HTTPException(status_code=413, detail=f"batch text exceeds {MAX_BATCH_CHARS} characters")
    try:
        return await extract(llm, request)
    except LLMRateLimited as err:
        return JSONResponse(
            status_code=429,
            content={"detail": str(err), "retry_after": err.retry_after},
            headers={"Retry-After": str(int(err.retry_after))},
        )
    except LLMError as err:
        raise HTTPException(status_code=502, detail=str(err)) from err
