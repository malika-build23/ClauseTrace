import { describe, it, expect } from 'vitest'
import { findQuoteInTextItems, normalizeQuote, type PdfTextItem } from '../lib/pdfHighlight'

describe('PDF Live Highlight Positioning & Exact Quote Safety', () => {
  // Simple viewport conversion mockup: flips Y or scales
  const mockViewportConvertPoint = (x: number, y: number): [number, number] => {
    return [x, 1000 - y]
  }

  it('normalizes quotes with smart apostrophes and excess whitespace', () => {
    const raw = '“Fund   Management  Entity’s   corpus”'
    expect(normalizeQuote(raw)).toBe('"fund management entity\'s corpus"')
  })

  it('accurately locates a quote within a single text item', () => {
    const items: PdfTextItem[] = [
      { str: 'Clause 18. ', transform: [12, 0, 0, 12, 50, 700], width: 60, height: 12 },
      { str: 'The minimum corpus of the angel fund shall be USD 1,000,000.', transform: [12, 0, 0, 12, 115, 700], width: 300, height: 12 },
    ]

    const result = findQuoteInTextItems(items, 'USD 1,000,000', mockViewportConvertPoint)
    expect(result.matched).toBe(true)
    expect(result.rects.length).toBe(1)
    expect(result.rects[0].x).toBe(115)
  })

  it('accurately locates a quote spanning multiple contiguous text items', () => {
    const items: PdfTextItem[] = [
      { str: 'The sponsor shall maintain ', transform: [12, 0, 0, 12, 50, 600], width: 140, height: 12 },
      { str: 'a minimum net worth ', transform: [12, 0, 0, 12, 195, 600], width: 120, height: 12 },
      { str: 'of USD 500,000.', transform: [12, 0, 0, 12, 320, 600], width: 90, height: 12 },
    ]

    const result = findQuoteInTextItems(items, 'minimum net worth of USD 500,000', mockViewportConvertPoint)
    expect(result.matched).toBe(true)
    expect(result.rects.length).toBeGreaterThanOrEqual(1)
  })

  it('STRICT SAFETY: strictly returns matched: false if quote is not present (never guesses coordinates)', () => {
    const items: PdfTextItem[] = [
      { str: 'Clause 4. Every FME must appoint a compliance officer.', transform: [12, 0, 0, 12, 50, 500], width: 280, height: 12 },
    ]

    const result = findQuoteInTextItems(items, 'minimum capital of USD 10,000,000', mockViewportConvertPoint)
    expect(result.matched).toBe(false)
    expect(result.rects).toEqual([])
    expect(result.reason).toContain('Quote could not be located')
  })

  it('STRICT SAFETY: returns false on empty text layer or empty quote', () => {
    expect(findQuoteInTextItems([], 'any quote', mockViewportConvertPoint).matched).toBe(false)
    expect(findQuoteInTextItems([{ str: 'test', transform: [1, 0, 0, 1, 0, 0], width: 10, height: 10 }], '', mockViewportConvertPoint).matched).toBe(false)
  })
})
