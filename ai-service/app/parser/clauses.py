"""Split regulatory text into numbered clauses with parent/child links.

Markers recognised at the start of a line:
  numeric        1.   4.2   4.2.1
  letters        (a)  a.  a)   (A)  A.
  roman numerals (i)  i.  i)   (I)  I.
Each letter/roman style (case + kind + punctuation) nests under whatever
was open when it first appeared, which matches how circulars are drafted
(e.g. 2 -> A. -> I. -> a.). A marker is accepted only when it is the next
expected label: 4.3 after 4.2, (b) after (a), or the first label of a new
style. Anything else is treated as wrapped text, which avoids false
clauses from prose such as "2 per cent" or "(see 7.1)".
"""

import re
from dataclasses import dataclass, field

from app.parser.text import Line, extract_lines

# Text after a marker is optional: some PDFs put "4.2" or "I." on its own line.
NUMERIC = re.compile(r"^(\d{1,3}(?:\.\d{1,3})*)(\.)?(?:\s+(\S.*))?$")
LABELLED = re.compile(r"^(?:\(([A-Za-z]{1,6})\)|([A-Za-z]{1,6})([.)]))(?:\s+(\S.*))?$")
_ONES = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"]
ROMAN = [t + o for t in ["", "x", "xx", "xxx"] for o in _ONES][1:]  # i .. xxxix


@dataclass
class ParsedClause:
    clause_number: str  # full reference, e.g. "4.2(a)(iv)"
    page: int  # page where the clause starts (1-based)
    text: str
    parent: str | None  # clause_number of the parent
    level: int
    position: int  # order in the document


@dataclass
class ParseResult:
    status: str  # "parsed" | "needs_manual_split"
    page_count: int
    clauses: list[ParsedClause] = field(default_factory=list)


@dataclass
class _Open:
    style: str  # "numeric" or e.g. "alpha-lower-paren"
    label: str
    clause: ParsedClause
    parts: list[str]


def _join(parts: list[str]) -> str:
    text = ""
    for part in parts:
        if text.endswith("-") and part[:1].islower():
            # A word split at a hyphen across lines. Regulations use real compound
            # hyphens ("close-ended", "ESG-related") far more than soft hyphenation,
            # so keep the hyphen and only drop the line break.
            text = text + part
        else:
            text = f"{text} {part}" if text else part
    return re.sub(r"\s+", " ", text).strip()


def _first(kind: str) -> str:
    return "a" if kind == "alpha" else "i"


def _next(kind: str, label: str) -> str | None:
    """Next label in sequence, compared in lower case."""
    if kind == "alpha":
        return chr(ord(label) + 1) if len(label) == 1 and label < "z" else None
    i = ROMAN.index(label) if label in ROMAN else -1
    return ROMAN[i + 1] if 0 <= i < len(ROMAN) - 1 else None


class _Splitter:
    def __init__(self) -> None:
        self.stack: list[_Open] = []
        self.clauses: list[ParsedClause] = []
        self.preamble: list[tuple[int, str]] = []
        self.last_numeric: list[int] | None = None

    # ── numeric clauses ──────────────────────────────────────────────────
    def _numeric_ok(self, parts: list[int], has_dot: bool) -> bool:
        if len(parts) == 1 and not has_dot:
            return False  # "10 per cent" is prose; "10." is a clause
        prev = self.last_numeric
        if prev is None:
            return parts[0] == 1
        for depth in range(1, len(prev) + 1):  # next sibling at any open depth
            if len(parts) == depth and parts[:-1] == prev[: depth - 1] and parts[-1] == prev[depth - 1] + 1:
                return True
        return parts[:-1] == prev and parts[-1] == 1  # first child: 4.2 -> 4.2.1

    def _open_numeric(self, parts: list[int], page: int, first: str) -> None:
        self.last_numeric = parts
        number = ".".join(map(str, parts))
        parent = ".".join(map(str, parts[:-1])) or None
        while self.stack and (self.stack[-1].style != "numeric" or self.stack[-1].clause.level >= len(parts)):
            self._close()
        if parent and not (self.stack and self.stack[-1].clause.clause_number == parent):
            parent = None  # e.g. "2.1" without a preceding "2."
        self._push("numeric", number, number, parent, page, first)

    # ── lettered / roman clauses ─────────────────────────────────────────
    def _candidates(self, raw: str, punct: str) -> list[tuple[str, str]]:
        """Possible (style, lower-case label) readings of a marker."""
        if not (raw.islower() or raw.isupper()):
            return []
        case = "lower" if raw.islower() else "upper"
        label = raw.lower()
        out = []
        if len(label) == 1:
            out.append((f"alpha-{case}-{punct}", label))
        if label in ROMAN:
            out.append((f"roman-{case}-{punct}", label))
        return out

    def _try_labelled(self, raw: str, punct: str, page: int, first: str) -> bool:
        if not self.stack:
            return False  # lettered items need an enclosing numbered clause
        siblings, children = [], []
        for style, label in self._candidates(raw, punct):
            kind = style.split("-")[0]
            idx = next((i for i in range(len(self.stack) - 1, -1, -1) if self.stack[i].style == style), None)
            if idx is not None and _next(kind, self.stack[idx].label) == label:
                siblings.append((idx, style, label))
            elif idx is None and label == _first(kind):
                children.append((style, label))
        if siblings:  # continuing a list wins: "(i)" after "(h)" is a letter
            idx, style, label = max(siblings)
            while len(self.stack) > idx:
                self._close()
        elif children:
            style, label = children[0]
        else:
            return False
        parent = self.stack[-1].clause.clause_number if self.stack else None
        self._push(style, label, f"{parent}({raw})", parent, page, first)
        return True

    # ── stack helpers ────────────────────────────────────────────────────
    def _push(self, style: str, label: str, number: str, parent: str | None, page: int, first: str) -> None:
        clause = ParsedClause(number, page, "", parent, len(self.stack) + 1, len(self.clauses))
        self.clauses.append(clause)
        self.stack.append(_Open(style, label, clause, [first] if first else []))

    def _close(self) -> None:
        item = self.stack.pop()
        item.clause.text = _join(item.parts)

    # ── main loop ────────────────────────────────────────────────────────
    def feed(self, line: Line) -> None:
        m = NUMERIC.match(line.text)
        if m:
            parts = [int(p) for p in m.group(1).split(".")]
            if self._numeric_ok(parts, bool(m.group(2))):
                self._open_numeric(parts, line.page, m.group(3) or "")
                return

        m = LABELLED.match(line.text)
        if m:
            raw = m.group(1) or m.group(2)
            punct = "paren" if m.group(1) else ("dot" if m.group(3) == "." else "bracket")
            if self._try_labelled(raw, punct, line.page, m.group(4) or ""):
                return

        if self.stack:
            self.stack[-1].parts.append(line.text)
        else:
            self.preamble.append((line.page, line.text))

    def finish(self) -> list[ParsedClause]:
        while self.stack:
            self._close()
        clauses = list(self.clauses)
        if self.preamble:
            pre = ParsedClause(
                "preamble", self.preamble[0][0], _join([t for _, t in self.preamble]), None, 0, 0
            )
            clauses.insert(0, pre)
        for i, c in enumerate(clauses):
            c.position = i
        return clauses


def _paragraph_fallback(lines: list[Line]) -> list[ParsedClause]:
    """No numbering found: one clause per PDF text block, flagged for manual split."""
    groups: list[tuple[int, list[str]]] = []
    last_key: tuple[int, int] | None = None
    for line in lines:
        key = (line.page, line.block)
        if key != last_key:
            groups.append((line.page, []))
            last_key = key
        groups[-1][1].append(line.text)
    return [
        ParsedClause(f"P{i + 1}", page, _join(parts), None, 1, i) for i, (page, parts) in enumerate(groups)
    ]


def split_clauses(lines: list[Line]) -> tuple[str, list[ParsedClause]]:
    splitter = _Splitter()
    for line in lines:
        splitter.feed(line)
    clauses = splitter.finish()
    if not any(c.clause_number != "preamble" for c in clauses):
        return "needs_manual_split", _paragraph_fallback(lines)
    return "parsed", clauses


def parse_pdf(pdf_bytes: bytes) -> ParseResult:
    lines, page_count = extract_lines(pdf_bytes)
    status, clauses = split_clauses(lines)
    return ParseResult(status=status, page_count=page_count, clauses=clauses)
