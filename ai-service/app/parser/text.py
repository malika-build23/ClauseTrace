"""PDF text extraction with page numbers and header/footer removal."""

import re
from collections import Counter
from dataclasses import dataclass

import pymupdf

# Lines inside this share of the page height (top or bottom) are header/footer candidates.
MARGIN_RATIO = 0.08
# A candidate line is dropped when it repeats on at least this share of pages.
REPEAT_RATIO = 0.5

PAGE_NUMBER = re.compile(r"^(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?$|^-\s*\d{1,4}\s*-$", re.IGNORECASE)


@dataclass
class Line:
    page: int  # 1-based
    text: str
    block: int  # PDF text block index on the page, used for paragraph fallback


REPLACEMENT_CHAR = "�"


def _clean(text: str) -> str:
    """Fix curly quotes that some PDF fonts export as U+FFFD.

    Between two letters it was an apostrophe (scheme's); elsewhere a double quote.
    """
    if REPLACEMENT_CHAR not in text:
        return text
    text = re.sub(rf"(?<=[A-Za-z]){REPLACEMENT_CHAR}(?=[A-Za-z])", "'", text)
    return text.replace(REPLACEMENT_CHAR, '"')


def _normalise(text: str) -> str:
    """Make repeated headers/footers comparable: 'Page 3 of 9' == 'Page 7 of 9'."""
    return re.sub(r"\d+", "#", text.strip().lower())


def extract_lines(pdf_bytes: bytes) -> tuple[list[Line], int]:
    """Return body lines (headers, footers and page numbers removed) and the page count."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        raw: list[tuple[int, str, int, bool]] = []  # page, text, block, in_margin
        for page_index, page in enumerate(doc):
            height = page.rect.height or 1
            for block_no, block in enumerate(page.get_text("dict", sort=True)["blocks"]):
                if block.get("type") != 0:  # skip images
                    continue
                for line in block["lines"]:
                    text = _clean("".join(span["text"] for span in line["spans"]).strip())
                    if not text:
                        continue
                    y0, y1 = line["bbox"][1], line["bbox"][3]
                    in_margin = y1 < height * MARGIN_RATIO or y0 > height * (1 - MARGIN_RATIO)
                    raw.append((page_index + 1, text, block_no, in_margin))
        page_count = doc.page_count
    finally:
        doc.close()

    # Count each margin line once per page.
    seen_per_page = {(p, _normalise(t)) for p, t, _, m in raw if m}
    repeats = Counter(norm for _, norm in seen_per_page)
    min_repeats = max(2, int(page_count * REPEAT_RATIO + 0.5))

    lines: list[Line] = []
    for page_no, text, block_no, in_margin in raw:
        if in_margin and (PAGE_NUMBER.match(text) or repeats[_normalise(text)] >= min_repeats):
            continue
        lines.append(Line(page=page_no, text=text, block=block_no))
    return lines, page_count
