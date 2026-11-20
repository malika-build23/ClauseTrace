"""Parse PDFs with the AI-service parser and print a spot-check report.

Usage (from ai-service/):  uv run --no-project python ../scripts/parse_report.py ../data/raw-pdfs/*.pdf
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service"))

from app.parser import parse_pdf  # noqa: E402


def main(paths: list[str]) -> None:
    for path in paths:
        result = parse_pdf(Path(path).read_bytes())
        name, count = Path(path).name, len(result.clauses)
        print(f"\n=== {name}: status={result.status} pages={result.page_count} clauses={count}")
        for c in result.clauses:
            indent = "  " * max(c.level - 1, 0)
            text = c.text if len(c.text) <= 110 else c.text[:107] + "..."
            print(f"{indent}[{c.clause_number}] p{c.page} parent={c.parent}: {text}")


if __name__ == "__main__":
    main(sys.argv[1:])
