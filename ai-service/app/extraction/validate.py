"""Deterministic checks on LLM output. Nothing here calls the model."""

import re
from dataclasses import dataclass, field

from pydantic import ValidationError

from app.extraction.models import ClauseIn, DocumentRef, LLMObligation, Rejection
from app.schemas import ExtractedObligation

VAGUE_TERMS = [
    "adequate",
    "appropriate",
    "as may be specified",
    "as may be prescribed",
    "as deemed fit",
    "reasonable",
    "suitable",
    "suitably",
    "sufficient",
    "wherever feasible",
    "where feasible",
    "from time to time",
    "satisfactory",
    "promptly",
]

MULTIPLIERS = {
    "thousand": 1e3,
    "lakh": 1e5,
    "lakhs": 1e5,
    "million": 1e6,
    "crore": 1e7,
    "crores": 1e7,
    "billion": 1e9,
}
NUMBER = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(thousand|lakhs?|million|crores?|billion)?", re.IGNORECASE)

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def normalise(text: str) -> str:
    """Compare text ignoring quote style, dash style, spacing and case."""
    return re.sub(r"\s+", " ", text.translate(_QUOTES)).strip().casefold()


def numbers_in(text: str) -> set[float]:
    found: set[float] = set()
    for digits, word in NUMBER.findall(text):
        try:
            value = float(digits.replace(",", ""))
        except ValueError:
            continue
        found.add(value)
        if word:
            found.add(value * MULTIPLIERS[word.lower()])
    return found


def vague_terms_in(text: str) -> list[str]:
    low = normalise(text)
    return [t for t in VAGUE_TERMS if re.search(rf"\b{re.escape(t)}\b", low)]


@dataclass
class ClauseCheck:
    obligations: list[ExtractedObligation] = field(default_factory=list)
    rejected: list[Rejection] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def check_obligation(
    ob: LLMObligation, clause: ClauseIn, document: DocumentRef, index: int, result: ClauseCheck
) -> None:
    """Validate one LLM obligation and append it to result as accepted or rejected."""
    quote = ob.quote.strip()
    if not quote or normalise(quote) not in normalise(clause.text):
        result.rejected.append(Rejection(reason="quote not found in clause text", quote=quote[:300]))
        return

    quote_numbers = numbers_in(quote)
    if ob.threshold is not None and ob.threshold.value not in quote_numbers:
        result.rejected.append(
            Rejection(reason=f"threshold value {ob.threshold.value:g} not found in quote", quote=quote[:300])
        )
        return
    if ob.deadline is not None:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", ob.deadline) or ob.deadline[:4] not in quote:
            result.rejected.append(
                Rejection(reason=f"deadline {ob.deadline} not stated in quote", quote=quote[:300])
            )
            return

    machine_checkable = ob.machine_checkable
    if machine_checkable and ob.threshold is None and ob.deadline is None:
        machine_checkable = False
        result.notes.append(
            f"{clause.clause_number}: machine_checkable set to false (no threshold or deadline)"
        )

    ambiguity_flag, ambiguity_reason = ob.ambiguity_flag, ob.ambiguity_reason
    vague = vague_terms_in(quote)
    if vague and not ambiguity_flag:
        ambiguity_flag = True
        ambiguity_reason = "Vague term(s) in source: " + ", ".join(vague)
        result.notes.append(
            f"{clause.clause_number}: ambiguity flagged by vague-term check ({', '.join(vague)})"
        )
    if ambiguity_flag and not ambiguity_reason:
        ambiguity_reason = "Flagged as ambiguous by the model without a stated reason"

    try:
        full = ExtractedObligation.model_validate(
            {
                "obligation_id": f"{clause.clause_number}-{index:02d}",  # backend assigns the stable key
                "source": {
                    "document": document.title,
                    "document_version": document.version_no,
                    "date": document.date,
                    "clause": clause.clause_number,
                    "page": clause.page,
                    "quote": quote,
                },
                "subject": ob.subject,
                "modality": ob.modality,
                "action": ob.action,
                "condition": ob.condition,
                "threshold": ob.threshold.model_dump() if ob.threshold else None,
                "deadline": ob.deadline,
                "evidence": ob.evidence,
                "ambiguity_flag": ambiguity_flag,
                "ambiguity_reason": ambiguity_reason,
                "machine_checkable": machine_checkable,
                "confidence": min(max(ob.confidence, 0.0), 1.0),
            }
        )
    except ValidationError as err:
        result.rejected.append(Rejection(reason=f"schema: {err.errors()[0]['msg']}", quote=quote[:300]))
        return
    result.obligations.append(full)
