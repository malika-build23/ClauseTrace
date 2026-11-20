"""Extraction flow: prompt -> LLM -> parse -> deterministic checks -> one retry."""

import logging

from pydantic import ValidationError

from app.extraction.llm import LLM, LLMError
from app.extraction.models import (
    ClauseExtraction,
    ClauseIn,
    ExtractorInfo,
    ExtractRequest,
    ExtractResponse,
    LLMBatch,
    Rejection,
)
from app.extraction.prompt import PROMPT_VERSION, build_user_prompt
from app.extraction.validate import ClauseCheck, check_obligation

log = logging.getLogger("clausetrace.extraction")


def extractor_info(model: str) -> ExtractorInfo:
    return ExtractorInfo(model=model, prompt_version=PROMPT_VERSION)


async def _attempt(
    llm: LLM, request: ExtractRequest, clauses: list[ClauseIn], used: list[str]
) -> dict[str, ClauseCheck] | None:
    """One model call for the given clauses. None means the whole response was unusable."""
    generation = await llm.generate(build_user_prompt(request.document, clauses))
    used.append(generation.model)
    try:
        batch = LLMBatch.model_validate_json(generation.text)
    except ValidationError as err:
        log.warning("invalid LLM JSON from %s: %s", generation.model, err.errors()[0]["msg"])
        return None

    by_number = {c.clause_number: c for c in clauses}
    checks: dict[str, ClauseCheck] = {}
    for result in batch.results:
        clause = by_number.get(result.clause_number)
        if clause is None or result.clause_number in checks:
            continue  # unknown or duplicated clause number from the model
        check = ClauseCheck()
        for i, ob in enumerate(result.obligations, start=1):
            check_obligation(ob, clause, request.document, i, check)
        checks[result.clause_number] = check
    return checks


def _needs_retry(check: ClauseCheck | None) -> bool:
    return check is None or bool(check.rejected)


async def extract(llm: LLM, request: ExtractRequest) -> ExtractResponse:
    """Extract obligations; clauses with invalid output are retried once."""
    used: list[str] = []
    first = await _attempt(llm, request, request.clauses, used) or {}
    final: dict[str, tuple[ClauseCheck | None, int]] = {
        c.clause_number: (first.get(c.clause_number), 1) for c in request.clauses
    }

    retry = [c for c in request.clauses if _needs_retry(final[c.clause_number][0])]
    if retry:
        try:
            second = await _attempt(llm, request, retry, used) or {}
        except LLMError as err:
            log.warning("retry failed: %s", err)
            second = {}
        for clause in retry:
            previous = final[clause.clause_number][0]
            again = second.get(clause.clause_number)
            # keep whichever attempt produced fewer rejections (ties go to the retry)
            if again is not None and (previous is None or len(again.rejected) <= len(previous.rejected)):
                final[clause.clause_number] = (again, 2)
            else:
                final[clause.clause_number] = (previous, 2)

    results = []
    for clause in request.clauses:
        check, attempts = final[clause.clause_number]
        if check is None:
            check = ClauseCheck(
                rejected=[Rejection(reason="model returned no usable result for this clause")]
            )
        for r in check.rejected:
            log.info("rejected %s: %s", clause.clause_number, r.reason)
        results.append(
            ClauseExtraction(
                clause_number=clause.clause_number,
                obligations=[o.model_dump() for o in check.obligations],
                rejected=check.rejected,
                notes=check.notes,
                attempts=attempts,
            )
        )
    return ExtractResponse(extractor=extractor_info(",".join(dict.fromkeys(used))), results=results)
