export type Segment = { text: string; marked: boolean }

/**
 * Split clause text into plain and highlighted segments for the given quotes.
 * Matching is case-insensitive; quotes that cannot be found are ignored
 * (the backend already verified each quote against a normalised clause text).
 */
export function highlightQuotes(text: string, quotes: string[]): Segment[] {
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const q of quotes) {
    const needle = q.trim().toLowerCase()
    if (!needle) continue
    const start = lower.indexOf(needle)
    if (start >= 0) ranges.push([start, start + needle.length])
  }
  if (ranges.length === 0) return [{ text, marked: false }]

  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }

  const out: Segment[] = []
  let pos = 0
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), marked: false })
    out.push({ text: text.slice(s, e), marked: true })
    pos = e
  }
  if (pos < text.length) out.push({ text: text.slice(pos), marked: false })
  return out
}
