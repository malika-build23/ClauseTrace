"""Compare AI-extracted obligations with a gold-label file: precision, recall, F1.

Read-only: it only reads obligations from the API.

Usage:
  CLAUSETRACE_EMAIL=viewer@clausetrace.demo CLAUSETRACE_PASSWORD=... \
  python scripts/evaluate_extraction.py <api-base-url> <document-id> data/gold-labels/angel-funds-2022.json

Matching (per clause): an extracted obligation matches a required gold
obligation with the same modality (true positive), else an optional gold
obligation with the same modality (ignored), else it is a false positive.
Unmatched required gold obligations are false negatives. Threshold accuracy
is measured on matched gold items that state a threshold.
"""

import json
import os
import sys
import urllib.request
from collections import Counter


def api(base: str, path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
        method="POST" if body else "GET",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read())


def main(base: str, document_id: str, gold_path: str) -> None:
    gold = json.load(open(gold_path, encoding="utf-8"))
    token = api(
        base,
        "/api/auth/login",
        body={"email": os.environ["CLAUSETRACE_EMAIL"], "password": os.environ["CLAUSETRACE_PASSWORD"]},
    )["token"]
    data = api(base, f"/api/documents/{document_id}/obligations?version={gold['document_version']}", token)
    extracted: dict[str, list[dict]] = {}
    for o in data["obligations"]:
        extracted.setdefault(o["clause"]["clauseNumber"], []).append(o)

    tp = fp = fn = 0
    threshold_total = threshold_ok = 0
    errors: Counter = Counter()
    lines = []
    clauses = sorted(
        set(gold["clauses"]) | set(extracted),
        key=lambda n: [int(p) if p.isdigit() else p for p in n.replace("(", ".").replace(")", "").split(".")],
    )
    for clause in clauses:
        g = gold["clauses"].get(clause, {})
        required = [dict(x, matched=False) for x in g.get("required", [])]
        optional = [dict(x, matched=False) for x in g.get("optional", [])]
        for o in extracted.get(clause, []):
            slot = next((x for x in required if not x["matched"] and x["modality"] == o["modality"]), None)
            if slot:
                slot["matched"] = True
                tp += 1
                if "threshold" in slot:
                    threshold_total += 1
                    t = o.get("thresholdJson") or {}
                    if (
                        t.get("operator") == slot["threshold"]["operator"]
                        and t.get("value") == slot["threshold"]["value"]
                    ):
                        threshold_ok += 1
                    else:
                        errors["wrong or missing threshold"] += 1
                        lines.append(f"  clause {clause}: threshold {t or None} vs gold {slot['threshold']}")
                continue
            opt = next((x for x in optional if not x["matched"] and x["modality"] == o["modality"]), None)
            if opt:
                opt["matched"] = True
                continue
            fp += 1
            kind = (
                "obligation found where gold has none"
                if not required
                else "extra or wrong-modality obligation"
            )
            errors[kind] += 1
            lines.append(f"  clause {clause}: extra {o['modality']} - {o['action'][:70]}")
        for x in required:
            if not x["matched"]:
                fn += 1
                errors["missed obligation"] += 1
                lines.append(f"  clause {clause}: missed {x['modality']} - {x['note'][:70]}")

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    print(f"Gold file status: {gold['status'][:60]}...")
    print(f"Document: {gold['document']} (version {gold['document_version']})")
    print(f"TP={tp} FP={fp} FN={fn}  precision={precision:.2f} recall={recall:.2f} F1={f1:.2f}")
    print(f"Threshold accuracy: {threshold_ok}/{threshold_total}")
    print("Error types:", dict(errors) or "none")
    if lines:
        print("Details:")
        print("\n".join(lines))


if __name__ == "__main__":
    main(*sys.argv[1:4])
