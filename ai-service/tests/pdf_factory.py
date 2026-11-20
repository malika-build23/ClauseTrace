"""Build small test PDFs with PyMuPDF so tests need no binary fixtures."""

import pymupdf


def make_pdf(pages: list[list[str]], header: str | None = None, footer: bool = False) -> bytes:
    doc = pymupdf.open()
    for page_no, lines in enumerate(pages, start=1):
        page = doc.new_page(width=595, height=842)  # A4
        if header:
            page.insert_text((50, 30), header, fontsize=9)
        if footer:
            page.insert_text((280, 825), f"Page {page_no} of {len(pages)}", fontsize=9)
        y = 90
        for line in lines:
            if line == "":
                y += 14  # blank line -> new text block in most layouts
                continue
            page.insert_text((50, y), line, fontsize=11)
            y += 16
    data = doc.tobytes()
    doc.close()
    return data
