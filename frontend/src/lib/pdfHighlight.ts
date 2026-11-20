export interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  height: number
}

export interface HighlightBox {
  x: number
  y: number
  width: number
  height: number
}

export interface QuoteMatch {
  matched: boolean
  rects: HighlightBox[]
  reason?: string
}

const NORM_ASCII: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
}

export function normalizeQuote(s: string): string {
  return s
    .replace(/[‘’“”–—]/g, (ch) => NORM_ASCII[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Searches for a quote across PDF text items.
 * If found, returns bounding boxes mapped through viewport point conversion.
 * If not found, strictly returns { matched: false } so no position is ever guessed.
 */
export function findQuoteInTextItems(
  items: PdfTextItem[],
  quote: string,
  convertToViewportPoint: (x: number, y: number) => [number, number],
): QuoteMatch {
  const target = normalizeQuote(quote)
  if (!target || items.length === 0) {
    return { matched: false, rects: [], reason: 'Empty quote or empty page text layer' }
  }

  // Build a continuous string with index mapping back to items
  let combined = ''
  const charMap: { itemIndex: number; charOffset: number }[] = []

  items.forEach((item, itemIdx) => {
    const s = item.str
    if (!s) return
    for (let c = 0; c < s.length; c++) {
      charMap.push({ itemIndex: itemIdx, charOffset: c })
    }
    combined += s
    // Add virtual space between items to allow natural multi-line matching
    charMap.push({ itemIndex: itemIdx, charOffset: -1 })
    combined += ' '
  })

  const normCombined = normalizeQuote(combined)
  const matchIndex = normCombined.indexOf(target)

  if (matchIndex === -1) {
    return {
      matched: false,
      rects: [],
      reason: 'Quote could not be located in the text layer of this page',
    }
  }

  // Find all item indices participating in this match
  const endIndex = matchIndex + target.length
  const matchedItemIndices = new Set<number>()

  for (let i = matchIndex; i < endIndex && i < charMap.length; i++) {
    const entry = charMap[i]
    if (entry && entry.charOffset >= 0) {
      matchedItemIndices.add(entry.itemIndex)
    }
  }

  if (matchedItemIndices.size === 0) {
    return {
      matched: false,
      rects: [],
      reason: 'No text items could be mapped to this quote',
    }
  }

  const rects: HighlightBox[] = []

  matchedItemIndices.forEach((idx) => {
    const item = items[idx]
    if (!item || !item.transform || item.width <= 0) return

    // item.transform: [scaleX, skewY, skewX, scaleY, tx, ty]
    const tx = item.transform[4] ?? 0
    const ty = item.transform[5] ?? 0
    const w = item.width
    // Estimate font height from scaleY or default
    const h = Math.abs(item.transform[3] || item.height || 10)

    const [vx1, vy1] = convertToViewportPoint(tx, ty)
    const [vx2, vy2] = convertToViewportPoint(tx + w, ty + h)

    const x = Math.min(vx1, vx2)
    const y = Math.min(vy1, vy2)
    const width = Math.abs(vx2 - vx1)
    const height = Math.abs(vy2 - vy1)

    // Merge with previous rect if they are virtually adjacent on the same line
    const last = rects[rects.length - 1]
    if (last && Math.abs(last.y - y) < 4 && Math.abs(last.x + last.width - x) < 12) {
      last.width = x + width - last.x
      last.height = Math.max(last.height, height)
    } else {
      rects.push({ x, y, width, height })
    }
  })

  return {
    matched: rects.length > 0,
    rects,
  }
}
