from fastapi.testclient import TestClient

from app.main import app
from app.parser import parse_pdf
from app.parser.clauses import split_clauses
from app.parser.text import Line
from tests.pdf_factory import make_pdf


def lines(*texts: str, page: int = 1) -> list[Line]:
    return [Line(page=page, text=t, block=i) for i, t in enumerate(texts)]


def by_number(clauses):
    return {c.clause_number: c for c in clauses}


# ── splitting logic ──────────────────────────────────────────────────────


def test_numeric_alpha_roman_hierarchy() -> None:
    status, clauses = split_clauses(
        lines(
            "CIRCULAR ON EXAMPLE MATTERS",
            "1. Applicability",
            "These directions apply to every FME.",
            "2. Requirements",
            "2.1 An FME shall maintain a net worth",
            "of at least the specified amount.",
            "(a) at the time of registration; and",
            "(b) on an ongoing basis, where",
            "(i) the first condition holds;",
            "(ii) the second condition holds.",
            "2.2 An FME shall report annually.",
            "3. Effective date",
        )
    )
    assert status == "parsed"
    c = by_number(clauses)
    assert list(c) == ["preamble", "1", "2", "2.1", "2.1(a)", "2.1(b)", "2.1(b)(i)", "2.1(b)(ii)", "2.2", "3"]
    assert c["2.1"].parent == "2"
    assert c["2.1(a)"].parent == "2.1"
    assert c["2.1(b)(ii)"].parent == "2.1(b)"
    assert c["2.1"].text == "An FME shall maintain a net worth of at least the specified amount."
    assert c["preamble"].text == "CIRCULAR ON EXAMPLE MATTERS"
    assert [x.position for x in clauses] == list(range(len(clauses)))


def test_prose_numbers_are_not_clauses() -> None:
    _, clauses = split_clauses(
        lines(
            "1. Fees",
            "The fee is",
            "10 per cent of turnover, payable within",
            "7. days is not a valid next clause",
            "2. Next clause",
        )
    )
    assert [c.clause_number for c in clauses] == ["1", "2"]
    assert "10 per cent" in clauses[0].text
    assert "7. days" in clauses[0].text


def test_letter_i_after_h_is_alpha_not_roman() -> None:
    letters = [f"({ch}) item {ch}" for ch in "abcdefgh"]
    _, clauses = split_clauses(lines("1. List", *letters, "(i) item i", "(j) item j"))
    numbers = [c.clause_number for c in clauses]
    assert "1(i)" in numbers and "1(j)" in numbers
    assert "1(h)(i)" not in numbers


def test_number_alone_on_its_line() -> None:
    _, clauses = split_clauses(lines("1.", "Heading text", "2.", "More text"))
    assert [(c.clause_number, c.text) for c in clauses] == [("1", "Heading text"), ("2", "More text")]


def test_hyphenated_words_rejoined() -> None:
    _, clauses = split_clauses(lines("1. The regu-", "lated entity shall comply."))
    assert clauses[0].text == "The regulated entity shall comply."


def test_no_numbering_falls_back_to_paragraphs() -> None:
    status, clauses = split_clauses(lines("Plain paragraph one.", "Plain paragraph two."))
    assert status == "needs_manual_split"
    assert [c.clause_number for c in clauses] == ["P1", "P2"]


# ── real PDF extraction ──────────────────────────────────────────────────


def test_pdf_pages_and_header_footer_removed() -> None:
    pdf = make_pdf(
        [
            ["1. Scope", "This applies to FMEs."],
            ["2. Duties", "2.1 Maintain records.", "2.2 File returns."],
            ["3. Commencement", "In force immediately."],
        ],
        header="IFSCA Circular (illustrative test document)",
        footer=True,
    )
    result = parse_pdf(pdf)
    assert result.status == "parsed"
    assert result.page_count == 3
    c = by_number(result.clauses)
    assert "preamble" not in c  # header removed, so nothing precedes clause 1
    assert c["1"].page == 1 and c["2.1"].page == 2 and c["3"].page == 3
    joined = " ".join(x.text for x in result.clauses)
    assert "Page" not in joined and "IFSCA Circular" not in joined


def test_clause_spanning_pages_keeps_start_page() -> None:
    pdf = make_pdf([["1. Start of clause one", "continues here"], ["and ends on page two.", "2. Second"]])
    c = by_number(parse_pdf(pdf).clauses)
    assert c["1"].page == 1
    assert c["1"].text.endswith("ends on page two.")


# ── HTTP endpoint ────────────────────────────────────────────────────────

client = TestClient(app)


def test_parse_endpoint_requires_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "t")
    res = client.post("/parse", files={"file": ("a.pdf", make_pdf([["1. X"]]), "application/pdf")})
    assert res.status_code == 401


def test_parse_endpoint_returns_clauses(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "t")
    pdf = make_pdf([["1. Scope", "Applies to FMEs.", "2. Duty", "(a) keep records"]])
    res = client.post(
        "/parse", headers={"X-Service-Token": "t"}, files={"file": ("a.pdf", pdf, "application/pdf")}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "parsed" and body["page_count"] == 1
    assert [c["clause_number"] for c in body["clauses"]] == ["1", "2", "2(a)"]
    assert body["clauses"][2]["parent"] == "2"


def test_parse_endpoint_rejects_non_pdf(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "t")
    res = client.post(
        "/parse", headers={"X-Service-Token": "t"}, files={"file": ("a.pdf", b"hello", "application/pdf")}
    )
    assert res.status_code == 415
