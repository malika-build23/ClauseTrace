"""LLM client. Tests replace it with a fake; CI never calls Gemini."""

import logging
import os
from dataclasses import dataclass
from typing import Protocol

from google import genai
from google.genai import errors, types

from app.extraction.models import LLMBatch
from app.extraction.prompt import SYSTEM_PROMPT

log = logging.getLogger("clausetrace.llm")

# Tried in order. On the free tier the larger flash models were often
# overloaded (503) or timed out (504) in testing (Nov 2026), while
# flash-lite answered reliably with good quality, so it goes first and the
# others are fallbacks. Override with GEMINI_MODELS (comma-separated).
DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]
PER_MODEL_TIMEOUT_MS = 75_000


class LLMError(Exception):
    """The model call failed or returned unusable output."""


class LLMRateLimited(LLMError):
    """Quota exhausted or every model overloaded; the caller should wait and retry."""

    def __init__(self, message: str, retry_after: float = 60.0) -> None:
        super().__init__(message)
        self.retry_after = retry_after


@dataclass
class Generation:
    text: str
    model: str  # the model that actually answered


class LLM(Protocol):
    async def generate(self, user_prompt: str) -> Generation: ...


class GeminiLLM:
    def __init__(self, api_key: str | None = None, models: list[str] | None = None) -> None:
        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise LLMError("GEMINI_API_KEY is not configured")
        configured = [m.strip() for m in os.environ.get("GEMINI_MODELS", "").split(",") if m.strip()]
        self.models = models or configured or DEFAULT_MODELS
        # One attempt per model: the fallback loop below decides what to try next,
        # so SDK-level retries would only hide how long a busy model takes.
        self._client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(
                timeout=PER_MODEL_TIMEOUT_MS, retry_options=types.HttpRetryOptions(attempts=1)
            ),
        )

    async def _call(self, model: str, user_prompt: str) -> str:
        response = await self._client.aio.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0,
                response_mime_type="application/json",
                response_schema=LLMBatch,
            ),
        )
        if not response.text:
            raise LLMError(f"{model} returned an empty response")
        return response.text

    async def generate(self, user_prompt: str) -> Generation:
        busy: list[str] = []
        for model in self.models:
            try:
                return Generation(text=await self._call(model, user_prompt), model=model)
            except errors.APIError as err:
                # 429 quota, 5xx overloaded/deadline, 404 retired model: try the next model.
                if err.code in (404, 429) or err.code >= 500:
                    log.warning("%s unavailable (%s), trying next model", model, err.code)
                    busy.append(f"{model}: {err.code}")
                    continue
                raise LLMError(f"Gemini error {err.code} on {model}: {err.message}") from err
            except LLMError:
                raise
            except Exception as err:  # transport errors: timeouts, resets (httpx types vary by SDK version)
                log.warning("%s failed (%s), trying next model", model, type(err).__name__)
                busy.append(f"{model}: {type(err).__name__}")
        raise LLMRateLimited("No Gemini model available (" + "; ".join(busy) + ")")
