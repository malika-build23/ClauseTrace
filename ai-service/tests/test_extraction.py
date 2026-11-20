import json

import pytest
from fastapi.testclient import TestClient

from app.extraction import ExtractRequest, extract
from app.extraction.llm import Generation, LLMRateLimited
from app.extraction.validate import numbers_in, vague_terms_in
from app.main import app, get_llm

CLAUSE_15 = (
    "An angel scheme shall not accept a commitment of an amount less than USD 40,000 "
    "from each angel investor, "
    "which may be accepted in instalments."
)
CLAUSE_18 = "An angel scheme shall have a corpus of at least USD 1,000,000, reckoned collectively."
CLAUSE_DEF = "“angel investor” means an investor including a Venture Capital Scheme."


def obligation(**overrides):
    ob = {
        "quote": "An angel scheme shall have a corpus of at least USD 1,000,000",
        "subject": "Angel scheme",
        "modality": "must",
        "action": "maintain a minimum corpus",
        "condition": None,
        "threshold": {"metric": "corpus", "operator": ">=", "value": 1000000, "unit": "USD"},
        "deadline": None,
        "evidence": None,
        "ambiguity_flag": False,
        "ambiguity_reason": None,
        "machine_checkable": True,
        "confidence": 0.9,
    }
    ob.update(overrides)
    return ob


def request(*clauses: tuple[str, str]) -> ExtractRequest:
    return ExtractRequest.model_validate(
        {
            "document": {"title": "Angel Funds (test)", "version_no": 1},
            "clauses": [{"clause_number": n, "page": 4, "text": t} for n, t in clauses],
        }
    )


class FakeLLM:
    """Returns queued responses in order and records the prompts it saw."""

    def __init__(self, *responses: dict | str | Exception, model: str = "fake-model") -> None:
        self.responses = list(responses)
        self.prompts: list[str] = []
        self.model = model

    async def generate(self, user_prompt: str) -> Generation:
        self.prompts.append(user_prompt)
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return Generation(text=item if isinstance(item, str) else json.dumps(item), model=self.model)


def batch(*results: tuple[str, list[dict]]) -> dict:
    return {"results": [{"clause_number": n, "obligations": obs} for n, obs in results]}


# ── deterministic helpers ────────────────────────────────────────────────


def test_numbers_in_handles_commas_and_multipliers() -> None:
    assert 1000000.0 in numbers_in("at least USD 1,000,000")
    assert 2.5 in numbers_in("at least 2.5% of the investment")
    assert 10000000.0 in numbers_in("INR 1 crore")
    assert 5000000.0 in numbers_in("USD 5 million")


def test_vague_terms_detected() -> None:
    assert vague_terms_in("shall maintain adequate records from time to time") == [
        "adequate",
        "from time to time",
    ]
    assert vague_terms_in("shall file within 30 days") == []


# ── extraction flow ──────────────────────────────────────────────────────


async def test_valid_obligation_gets_source_from_request_not_model() -> None:
    llm = FakeLLM(batch(("18", [obligation()])))
    res = await extract(llm, request(("18", CLAUSE_18)))
    [clause] = res.results
    assert clause.attempts == 1 and clause.rejected == []
    [ob] = clause.obligations
    assert ob["source"] == {
        "document": "Angel Funds (test)",
        "document_version": 1,
        "date": None,
        "clause": "18",
        "page": 4,
        "quote": "An angel scheme shall have a corpus of at least USD 1,000,000",
    }
    assert ob["status"] == "proposed"
    assert res.extractor.model == "fake-model"


async def test_quote_not_in_clause_is_rejected_then_retried() -> None:
    bad = obligation(quote="An angel scheme must hold USD 1,000,000")  # paraphrase
    llm = FakeLLM(batch(("18", [bad])), batch(("18", [obligation()])))
    res = await extract(llm, request(("18", CLAUSE_18)))
    [clause] = res.results
    assert clause.attempts == 2
    assert len(clause.obligations) == 1 and clause.rejected == []
    assert len(llm.prompts) == 2


async def test_rejection_kept_when_retry_also_fails() -> None:
    bad = obligation(quote="not in the clause")
    llm = FakeLLM(batch(("18", [bad])), batch(("18", [bad])))
    [clause] = (await extract(llm, request(("18", CLAUSE_18)))).results
    assert clause.obligations == []
    assert clause.rejected[0].reason == "quote not found in clause text"


async def test_threshold_value_must_appear_in_quote() -> None:
    wrong = obligation(threshold={"metric": "corpus", "operator": ">=", "value": 2000000, "unit": "USD"})
    llm = FakeLLM(batch(("18", [wrong])), batch(("18", [wrong])))
    [clause] = (await extract(llm, request(("18", CLAUSE_18)))).results
    assert clause.obligations == []
    assert "2e+06" in clause.rejected[0].reason or "2000000" in clause.rejected[0].reason


async def test_quote_matching_ignores_curly_quotes_and_spacing() -> None:
    ob = obligation(
        quote='"angel investor"   means an investor',
        modality="may",
        threshold=None,
        machine_checkable=False,
    )
    [clause] = (await extract(FakeLLM(batch(("1", [ob]))), request(("1", CLAUSE_DEF)))).results
    assert len(clause.obligations) == 1


async def test_machine_checkable_without_threshold_is_downgraded() -> None:
    ob = obligation(threshold=None, machine_checkable=True)
    [clause] = (await extract(FakeLLM(batch(("18", [ob]))), request(("18", CLAUSE_18)))).results
    assert clause.obligations[0]["machine_checkable"] is False
    assert any("machine_checkable set to false" in n for n in clause.notes)


async def test_vague_term_sets_ambiguity_flag() -> None:
    text = "The FME shall maintain adequate records of each investment."
    ob = obligation(quote="The FME shall maintain adequate records", threshold=None, machine_checkable=False)
    [clause] = (await extract(FakeLLM(batch(("9", [ob]))), request(("9", text)))).results
    assert clause.obligations[0]["ambiguity_flag"] is True
    assert "adequate" in clause.obligations[0]["ambiguity_reason"]


async def test_empty_result_for_definitions_is_accepted() -> None:
    [clause] = (await extract(FakeLLM(batch(("1", []))), request(("1", CLAUSE_DEF)))).results
    assert clause.obligations == [] and clause.rejected == [] and clause.attempts == 1


async def test_invalid_json_is_retried() -> None:
    llm = FakeLLM("not json", batch(("18", [obligation()])))
    [clause] = (await extract(llm, request(("18", CLAUSE_18)))).results
    assert clause.attempts == 2 and len(clause.obligations) == 1


async def test_missing_clause_in_model_output_is_retried_only_for_that_clause() -> None:
    llm = FakeLLM(batch(("18", [obligation()])), batch(("15", [])))
    res = await extract(llm, request(("15", CLAUSE_15), ("18", CLAUSE_18)))
    assert [c.attempts for c in res.results] == [2, 1]
    assert '"clause_number": "18"' not in llm.prompts[1]  # retry only sent clause 15


async def test_unknown_clause_numbers_from_model_are_ignored() -> None:
    llm = FakeLLM(batch(("18", [obligation()]), ("99", [obligation()])))
    res = await extract(llm, request(("18", CLAUSE_18)))
    assert [c.clause_number for c in res.results] == ["18"]


async def test_rate_limit_propagates() -> None:
    with pytest.raises(LLMRateLimited):
        await extract(FakeLLM(LLMRateLimited("busy")), request(("18", CLAUSE_18)))


# ── HTTP endpoint ────────────────────────────────────────────────────────


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "t")
    yield TestClient(app)
    app.dependency_overrides.clear()


def body(*clauses):
    return {
        "document": {"title": "Angel Funds (test)", "version_no": 1},
        "clauses": [{"clause_number": n, "page": 4, "text": t} for n, t in clauses],
    }


def test_extract_endpoint(client) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLLM(batch(("18", [obligation()])))
    res = client.post("/extract", headers={"X-Service-Token": "t"}, json=body(("18", CLAUSE_18)))
    assert res.status_code == 200
    data = res.json()
    assert data["extractor"]["prompt_version"]
    assert data["results"][0]["obligations"][0]["source"]["clause"] == "18"


def test_extract_endpoint_requires_token(client) -> None:
    assert client.post("/extract", json=body(("18", CLAUSE_18))).status_code == 401


def test_extract_endpoint_rate_limit_returns_429(client) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLLM(LLMRateLimited("busy", retry_after=42))
    res = client.post("/extract", headers={"X-Service-Token": "t"}, json=body(("18", CLAUSE_18)))
    assert res.status_code == 429
    assert res.headers["retry-after"] == "42"


def test_extract_endpoint_rejects_too_many_clauses(client) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLLM()
    clauses = [(str(i), "text") for i in range(21)]
    res = client.post("/extract", headers={"X-Service-Token": "t"}, json=body(*clauses))
    assert res.status_code == 422
