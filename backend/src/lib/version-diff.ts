/**
 * Clause alignment between two document versions, and word-level text diff.
 * Pure functions, no I/O, unit-tested.
 */

export type ClauseText = { clauseNumber: string; text: string };

export type Alignment<T extends ClauseText = ClauseText> =
  | { type: "unchanged"; old: T; new: T; renumbered: boolean }
  | { type: "modified"; old: T; new: T; renumbered: boolean; similarity: number }
  | { type: "added"; new: T }
  | { type: "removed"; old: T };

export type DiffSegment = { op: "equal" | "insert" | "delete"; text: string };

/** Same-number pairs at least this similar count as "modified" rather than removed + added. */
export const SAME_NUMBER_MIN_SIMILARITY = 0.4;
/** Pairs across different numbers need more similarity to count as a moved clause. */
export const MOVED_MIN_SIMILARITY = 0.6;

export function normalise(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    // "early-stage" vs "earlystage": a hyphen inside a word is layout, not a change in meaning
    .replace(/(\p{L})-(\p{L})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ASCII: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-" };
const toAscii = (text: string) => text.replace(/[‘’“”–—]/g, (ch) => ASCII[ch]);

// Quote and dash styles are unified before splitting, so "FME’s" and "FME's" are the same word.
const tokens = (text: string) => toAscii(text).match(/[\p{L}\p{N}][\p{L}\p{N},.%$'-]*|[^\s\p{L}\p{N}]/gu) ?? [];

/** Length of the longest common subsequence of two token lists. */
function lcsTable(a: string[], b: string[]): number[][] {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    }
  }
  return t;
}

/** Similarity 0..1 like difflib's ratio: 2 * matches / total tokens (case-insensitive). */
export function similarity(a: string, b: string): number {
  const ta = tokens(normalise(a));
  const tb = tokens(normalise(b));
  if (ta.length === 0 && tb.length === 0) return 1;
  // Long clauses: compare on a capped prefix to bound the O(n*m) cost.
  const cap = 600;
  const x = ta.slice(0, cap);
  const y = tb.slice(0, cap);
  return (2 * lcsTable(x, y)[0][0]) / (x.length + y.length);
}

/** Word-level diff for display. Comparison ignores case; output keeps the original words. */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const a = tokens(oldText);
  const b = tokens(newText);
  const la = a.map((w) => normalise(w));
  const lb = b.map((w) => normalise(w));
  const t = lcsTable(la, lb);
  const out: DiffSegment[] = [];
  const push = (op: DiffSegment["op"], word: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += ` ${word}`;
    else out.push({ op, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (la[i] === lb[j]) {
      push("equal", b[j]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) {
      push("delete", a[i++]);
    } else {
      push("insert", b[j++]);
    }
  }
  while (i < a.length) push("delete", a[i++]);
  while (j < b.length) push("insert", b[j++]);
  return out;
}

/**
 * Align clauses of two versions:
 * 1. identical text (after normalising) -> unchanged, even if renumbered;
 * 2. same clause number and similar text -> modified;
 * 3. similar text under a different number -> modified (renumbered);
 * 4. the rest -> removed (old) or added (new).
 * Step 1 first means inserting one clause does not mark every later,
 * renumbered clause as modified.
 */
export function alignClauses<T extends ClauseText>(oldClauses: T[], newClauses: T[]): Alignment<T>[] {
  const out: Alignment<T>[] = [];
  const oldLeft = new Set(oldClauses.map((_, i) => i));
  const newLeft = new Set(newClauses.map((_, i) => i));

  // 1. identical text
  const oldByText = new Map<string, number[]>();
  oldClauses.forEach((c, i) => {
    const key = normalise(c.text);
    oldByText.set(key, [...(oldByText.get(key) ?? []), i]);
  });
  newClauses.forEach((c, j) => {
    const candidates = (oldByText.get(normalise(c.text)) ?? []).filter((i) => oldLeft.has(i));
    if (candidates.length === 0) return;
    const i = candidates.find((k) => oldClauses[k].clauseNumber === c.clauseNumber) ?? candidates[0];
    oldLeft.delete(i);
    newLeft.delete(j);
    out.push({ type: "unchanged", old: oldClauses[i], new: c, renumbered: oldClauses[i].clauseNumber !== c.clauseNumber });
  });

  // 2. same number, similar text
  const oldByNumber = new Map<string, number>();
  for (const i of oldLeft) oldByNumber.set(oldClauses[i].clauseNumber, i);
  for (const j of [...newLeft]) {
    const i = oldByNumber.get(newClauses[j].clauseNumber);
    if (i === undefined || !oldLeft.has(i)) continue;
    const s = similarity(oldClauses[i].text, newClauses[j].text);
    if (s < SAME_NUMBER_MIN_SIMILARITY) continue;
    oldLeft.delete(i);
    newLeft.delete(j);
    out.push({ type: "modified", old: oldClauses[i], new: newClauses[j], renumbered: false, similarity: s });
  }

  // 3. similar text, different number (best pairs first)
  const pairs: { i: number; j: number; s: number }[] = [];
  for (const i of oldLeft) {
    for (const j of newLeft) {
      const s = similarity(oldClauses[i].text, newClauses[j].text);
      if (s >= MOVED_MIN_SIMILARITY) pairs.push({ i, j, s });
    }
  }
  pairs.sort((x, y) => y.s - x.s);
  for (const { i, j, s } of pairs) {
    if (!oldLeft.has(i) || !newLeft.has(j)) continue;
    oldLeft.delete(i);
    newLeft.delete(j);
    out.push({ type: "modified", old: oldClauses[i], new: newClauses[j], renumbered: true, similarity: s });
  }

  // 4. leftovers
  for (const i of oldLeft) out.push({ type: "removed", old: oldClauses[i] });
  for (const j of newLeft) out.push({ type: "added", new: newClauses[j] });
  return out;
}

/** Short human-readable description of a change. */
export function describe(a: Alignment): string {
  switch (a.type) {
    case "added":
      return `Clause ${a.new.clauseNumber} added`;
    case "removed":
      return `Clause ${a.old.clauseNumber} removed`;
    case "unchanged":
      return a.renumbered ? `Clause ${a.old.clauseNumber} renumbered to ${a.new.clauseNumber}, text unchanged` : `Clause ${a.new.clauseNumber} unchanged`;
    case "modified": {
      const changed = wordDiff(a.old.text, a.new.text).filter((s) => s.op !== "equal");
      const removed = changed.filter((s) => s.op === "delete").map((s) => s.text);
      const inserted = changed.filter((s) => s.op === "insert").map((s) => s.text);
      const where = a.renumbered ? `Clause ${a.old.clauseNumber} (now ${a.new.clauseNumber})` : `Clause ${a.new.clauseNumber}`;
      const detail =
        removed.length === 1 && inserted.length === 1
          ? `"${clip(removed[0])}" changed to "${clip(inserted[0])}"`
          : `${inserted.length} insertion(s), ${removed.length} deletion(s)`;
      return `${where} modified: ${detail}`;
    }
  }
}

const clip = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);
