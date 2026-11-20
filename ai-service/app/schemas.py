"""Shared obligation schema (mirrors backend/src/schemas/obligation.ts)."""

from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

Modality = Literal["must", "must_not", "may", "should"]
Operator = Literal[">=", ">", "<=", "<", "==", "!="]
ObligationStatus = Literal["proposed", "approved", "edited", "rejected"]
ISO_DATE = r"^\d{4}-\d{2}-\d{2}$"


class Threshold(BaseModel):
    metric: str = Field(min_length=1)
    operator: Operator
    value: float
    unit: str | None


class Source(BaseModel):
    document: str = Field(min_length=1)
    document_version: int = Field(gt=0)
    date: str | None = Field(pattern=ISO_DATE)
    clause: str = Field(min_length=1)
    page: int = Field(gt=0)
    quote: str = Field(min_length=1)


class ExtractedObligation(BaseModel):
    obligation_id: str = Field(min_length=1)
    source: Source
    subject: str = Field(min_length=1)
    modality: Modality
    action: str = Field(min_length=1)
    condition: str | None
    threshold: Threshold | None
    deadline: str | None = Field(pattern=ISO_DATE)
    evidence: str | None
    ambiguity_flag: bool
    ambiguity_reason: str | None
    machine_checkable: bool
    confidence: float = Field(ge=0, le=1)
    status: ObligationStatus = "proposed"
    approved_by: str | None = None
    version: int = Field(default=1, gt=0)

    @model_validator(mode="after")
    def check_consistency(self) -> Self:
        if self.ambiguity_flag and not self.ambiguity_reason:
            raise ValueError("ambiguity_reason is required when ambiguity_flag is true")
        if self.machine_checkable and self.threshold is None and self.deadline is None:
            raise ValueError("machine_checkable requires an explicit threshold or deadline")
        return self
