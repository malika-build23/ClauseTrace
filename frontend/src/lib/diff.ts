export type DiffSegment = { op: 'equal' | 'insert' | 'delete'; text: string }

const ASCII: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-' }
const toAscii = (s: string) => s.replace(/[‘’“”–—]/g, (ch) => ASCII[ch])
const tokens = (s: string) => toAscii(s).match(/[\p{L}\p{N}][\p{L}\p{N},.%$'-]*|[^\s\p{L}\p{N}]/gu) ?? []
const norm = (w: string) => w.toLowerCase().replace(/(\p{L})-(\p{L})/gu, '$1$2')

/** Word-level diff for display (same rules as the backend comparison). */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const a = tokens(oldText)
  const b = tokens(newText)
  const la = a.map(norm)
  const lb = b.map(norm)
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) t[i][j] = la[i] === lb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
  }
  const out: DiffSegment[] = []
  const push = (op: DiffSegment['op'], w: string) => {
    const last = out[out.length - 1]
    if (last && last.op === op) last.text += ` ${w}`
    else out.push({ op, text: w })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (la[i] === lb[j]) {
      push('equal', b[j])
      i++
      j++
    } else if (t[i + 1][j] >= t[i][j + 1]) push('delete', a[i++])
    else push('insert', b[j++])
  }
  while (i < a.length) push('delete', a[i++])
  while (j < b.length) push('insert', b[j++])
  return out
}
