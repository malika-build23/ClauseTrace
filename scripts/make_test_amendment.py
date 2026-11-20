"""Build a manually amended TEST copy of the Angel Funds circular for change detection.

The output is clearly stamped as a test copy on every page. It is NOT an IFSCA
publication. Changes made (so results can be checked against a known answer):
  - clause 14: investor cap 200 -> 250
  - clause 18: minimum corpus USD 1,000,000 -> USD 1,500,000
  - clause 21 (leverage) removed; later clauses renumbered down by one
  - new last clause: annual compliance report due March 31, 2027

Usage (from ai-service/):
  uv run --no-project python ../scripts/make_test_amendment.py \
      ../data/raw-pdfs/ifsca-angel-funds-2022.pdf ../data/test-amendments/angel-funds-TEST-amendment.pdf
"""

import re
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service"))

import pymupdf  # noqa: E402

from app.parser import parse_pdf  # noqa: E402

STAMP = (
    "TEST COPY - manually amended by the ClauseTrace team to test change detection. Not an IFSCA publication."
)
NEW_CLAUSE = (
    "The FME managing an angel scheme shall submit an annual compliance report for the financial year "
    "2026-27 to the Authority on or before March 31, 2027."
)
ASCII = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def amend(clauses):
    out = []
    for c in clauses:
        text = c.text.translate(ASCII)
        top = re.match(r"^(\d+)", c.clause_number)
        if top and top.group(1) == "21":
            continue  # removed
        if c.clause_number == "14":
            text = text.replace("200 (two hundred)", "250 (two hundred and fifty)")
        if c.clause_number == "18":
            text = text.replace("USD 1,000,000", "USD 1,500,000")
        out.append((c.clause_number, text))
    last_top = max(int(re.match(r"^(\d+)", n).group(1)) for n, _ in out if re.match(r"^\d+", n))
    out.append((str(last_top + 1), NEW_CLAUSE))  # numbered before renumbering
    return out


def renumber(number: str) -> str:
    """Shift top-level numbers after the removed clause 21 down by one."""
    m = re.match(r"^(\d+)(.*)$", number)
    if not m or int(m.group(1)) <= 21:
        return number
    return f"{int(m.group(1)) - 1}{m.group(2)}"


def label(number: str) -> str:
    """'7(a)(i)' -> '(i)', '2.1' -> '2.1', '7' -> '7.'"""
    brackets = re.findall(r"\([^)]*\)", number)
    if brackets:
        return brackets[-1]
    return number if "." in number else f"{number}."


def write_pdf(items, out_path: Path) -> None:
    doc = pymupdf.open()
    page, y = None, 0.0

    def new_page():
        nonlocal page, y
        page = doc.new_page(width=595, height=842)
        page.insert_text((40, 28), STAMP, fontsize=7.5, color=(0.7, 0, 0))
        y = 70

    new_page()
    for number, text in items:
        depth = 0 if number == "preamble" else number.count("(")
        indent = 50 + depth * 22
        prefix = "" if number == "preamble" else f"{label(number)} "
        lines = textwrap.wrap(prefix + text, width=95 - depth * 4) or [prefix]
        for line in lines:
            if y > 790:
                new_page()
            page.insert_text((indent, y), line, fontsize=10)
            y += 14
        y += 6
    for i, p in enumerate(doc, start=1):
        p.insert_text((270, 825), f"Page {i} of {doc.page_count}", fontsize=8)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out_path)
    doc.close()


def main(src: str, dst: str) -> None:
    parsed = parse_pdf(Path(src).read_bytes())
    items = [(renumber(n) if n != "preamble" else n, t) for n, t in amend(parsed.clauses)]
    write_pdf(items, Path(dst))
    print(f"wrote {dst}: {len(items)} clauses")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
