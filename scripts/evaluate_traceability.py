"""Traceability check: does every obligation's quote appear in the original PDF
on the page its clause cites (or the next pages, for clauses that run on)?

Read-only. Downloads each document version's stored PDF through the API.

Usage (from ai-service/, so PyMuPDF is available):
  CLAUSETRACE_EMAIL=... CLAUSETRACE_PASSWORD=... \
  uv run --no-project python ../scripts/evaluate_traceability.py <api-base-url>
"""

import json
import os
import re
import sys
import urllib.request

import pymupdf

QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-"})


def norm(text: str) -> str:
    text = text.translate(QUOTES).lower()
    text = re.sub(r"(\w)-\s*\n?\s*(\w)", r"\1\2", text)  # line-break hyphens and compound hyphens
    return re.sub(r"[^a-z0-9%$.,]+", " ", text).strip()


def request(base: str, path: str, token: str | None = None, body: dict | None = None, raw: bool = False):
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method="POST" if body else "GET",
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        data = res.read()
    return data if raw else json.loads(data)


def main(base: str) -> None:
    token = request(
        base,
        "/api/auth/login",
        body={"email": os.environ["CLAUSETRACE_EMAIL"], "password": os.environ["CLAUSETRACE_PASSWORD"]},
    )["token"]
    obligations = request(base, "/api/obligations?allVersions=true&limit=500", token)
    pdfs: dict[tuple[str, int], list[str]] = {}
    exact = later = missing = 0
    problems = []
    for o in obligations:
        dv = o["clause"]["documentVersion"]
        key = (dv["document"]["id"], dv["versionNo"])
        if key not in pdfs:
            data = request(base, f"/api/documents/{key[0]}/versions/{key[1]}/file", token, raw=True)
            doc = pymupdf.open(stream=data, filetype="pdf")
            pdfs[key] = [norm(page.get_text()) for page in doc]
            doc.close()
        pages = pdfs[key]
        page = o["clause"]["page"]
        snippet = " ".join(norm(o["quote"]).split()[:8])
        if snippet and snippet in pages[page - 1]:
            exact += 1
        elif any(snippet in p for p in pages[page : page + 2]):
            later += 1  # clause starts on the cited page and continues
        else:
            missing += 1
            problems.append(
                f"  {o['obligationKey']} (clause {o['clause']['clauseNumber']}, cited p.{page}): '{snippet}'"
            )
    total = len(obligations)
    print(f"Obligations checked: {total} across {len(pdfs)} document version(s)")
    print(f"Quote on the cited page: {exact}")
    print(f"Quote on the next page (clause continues across a page break): {later}")
    print(f"Quote not found near the cited page: {missing}")
    if problems:
        print("\n".join(problems))


if __name__ == "__main__":
    main(sys.argv[1])
