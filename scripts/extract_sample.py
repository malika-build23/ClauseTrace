"""Run real Gemini extraction on selected clauses of a PDF and print the results.

Usage (from ai-service/, with GEMINI_API_KEY set):
  uv run --no-project python ../scripts/extract_sample.py ../data/raw-pdfs/ifsca-angel-funds-2022.pdf 14 15 18
"""

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service"))

from app.extraction import ExtractRequest, GeminiLLM, extract  # noqa: E402
from app.parser import parse_pdf  # noqa: E402


async def main(pdf: str, numbers: list[str]) -> None:
    parsed = parse_pdf(Path(pdf).read_bytes())
    clauses = [c for c in parsed.clauses if c.clause_number in numbers]
    request = ExtractRequest.model_validate(
        {
            "document": {"title": Path(pdf).stem, "version_no": 1},
            "clauses": [{"clause_number": c.clause_number, "page": c.page, "text": c.text} for c in clauses],
        }
    )
    started = time.perf_counter()
    result = await extract(GeminiLLM(), request)
    elapsed = time.perf_counter() - started
    print(f"model={result.extractor.model} prompt={result.extractor.prompt_version} {elapsed:.1f}s")
    for r in result.results:
        counts = f"attempts={r.attempts} accepted={len(r.obligations)} rejected={len(r.rejected)}"
        print(f"\n[{r.clause_number}] {counts}")
        for ob in r.obligations:
            keep = [
                "modality",
                "subject",
                "action",
                "condition",
                "threshold",
                "deadline",
                "ambiguity_flag",
                "ambiguity_reason",
                "machine_checkable",
                "confidence",
            ]
            print("  +", json.dumps({k: ob[k] for k in keep}, ensure_ascii=False))
            print("    quote:", ob["source"]["quote"][:160])
        for rej in r.rejected:
            print("  -", rej.reason, "|", (rej.quote or "")[:120])
        for note in r.notes:
            print("  note:", note)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2:]))
