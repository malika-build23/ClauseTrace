"""Request/response models for obligation extraction.

LLM* models describe exactly what the model is asked to return. Source
metadata (document, version, clause, page) is never taken from the model:
the service fills it in from the request, so it cannot be hallucinated.
"""

from pydantic import BaseModel, Field

from app.schemas import Modality, Operator

# ── what the LLM returns ─────────────────────────────────────────────────


class LLMThreshold(BaseModel):
    metric: str = Field(description="snake_case name of the measured quantity, e.g. net_worth")
    operator: Operator
    value: float = Field(description="the number exactly as stated in the quote, without unit words")
    unit: str | None = Field(description="e.g. USD, %, days, investors; null if none")


class LLMObligation(BaseModel):
    quote: str = Field(description="exact contiguous text copied from the clause that states the obligation")
    subject: str = Field(description="who must act, e.g. 'FME', 'Angel scheme'")
    modality: Modality
    action: str = Field(description="what must (or must not) be done, in a short phrase")
    condition: str | None = Field(
        description="when/if the obligation applies, as stated; null if unconditional"
    )
    threshold: LLMThreshold | None = Field(description="only if a numeric limit is explicitly stated")
    deadline: str | None = Field(
        description="YYYY-MM-DD only if an explicit calendar date is stated, else null"
    )
    evidence: str | None = Field(description="record or filing that would evidence compliance, if stated")
    ambiguity_flag: bool
    ambiguity_reason: str | None
    machine_checkable: bool = Field(
        description="true only if an explicit threshold or deadline can be checked"
    )
    confidence: float = Field(ge=0, le=1)


class LLMClauseResult(BaseModel):
    clause_number: str
    obligations: list[LLMObligation]


class LLMBatch(BaseModel):
    results: list[LLMClauseResult]


# ── API request / response ───────────────────────────────────────────────


class DocumentRef(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    version_no: int = Field(gt=0)
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class ClauseIn(BaseModel):
    clause_number: str = Field(min_length=1, max_length=100)
    page: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=12_000)


class ExtractRequest(BaseModel):
    document: DocumentRef
    clauses: list[ClauseIn] = Field(min_length=1, max_length=20)


class Rejection(BaseModel):
    reason: str
    quote: str | None = None


class ClauseExtraction(BaseModel):
    clause_number: str
    obligations: list[dict]  # app.schemas.ExtractedObligation as JSON
    rejected: list[Rejection]
    notes: list[str]  # deterministic adjustments made after validation
    attempts: int


class ExtractorInfo(BaseModel):
    model: str  # model(s) that answered, comma-separated if a retry used another
    prompt_version: str  # part of the backend cache key; bump it when the prompt changes


class ExtractResponse(BaseModel):
    extractor: ExtractorInfo
    results: list[ClauseExtraction]
