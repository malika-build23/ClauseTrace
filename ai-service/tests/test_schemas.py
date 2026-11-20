import pytest
from pydantic import ValidationError

from app.schemas import ExtractedObligation


def valid_payload(**overrides):
    payload = {
        "obligation_id": "FME-EXAMPLE-c4.2-01",
        "source": {
            "document": "Example regulatory document",
            "document_version": 1,
            "date": "2025-01-15",
            "clause": "4.2",
            "page": 3,
            "quote": "Exact source text",
        },
        "subject": "Example regulated entity",
        "modality": "must",
        "action": "maintain a required measure",
        "condition": None,
        "threshold": {"metric": "example_metric", "operator": ">=", "value": 1000000, "unit": "USD"},
        "deadline": None,
        "evidence": None,
        "ambiguity_flag": False,
        "ambiguity_reason": None,
        "machine_checkable": True,
        "confidence": 0.82,
    }
    payload.update(overrides)
    return payload


def test_valid_obligation_parses() -> None:
    ob = ExtractedObligation.model_validate(valid_payload())
    assert ob.status == "proposed"
    assert ob.version == 1


def test_rejects_unknown_modality() -> None:
    with pytest.raises(ValidationError):
        ExtractedObligation.model_validate(valid_payload(modality="shall"))


def test_ambiguity_flag_requires_reason() -> None:
    with pytest.raises(ValidationError):
        ExtractedObligation.model_validate(valid_payload(ambiguity_flag=True))


def test_machine_checkable_requires_threshold_or_deadline() -> None:
    with pytest.raises(ValidationError):
        ExtractedObligation.model_validate(valid_payload(threshold=None))


def test_confidence_out_of_range() -> None:
    with pytest.raises(ValidationError):
        ExtractedObligation.model_validate(valid_payload(confidence=1.5))
