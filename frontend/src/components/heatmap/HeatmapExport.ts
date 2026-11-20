import type { EvaluationResult } from '../../lib/api'

export interface HeatmapExportRow {
  entityName: string
  entityCategory: string
  ruleKey: string
  ruleType: string
  result: EvaluationResult | 'NOT_EVALUATED'
  explanation: string
  evaluationDate: string
}

export function exportHeatmapToCsv(rows: HeatmapExportRow[], filename = 'compliance-heatmap.csv'): void {
  const headers = ['Entity Name', 'Category', 'Rule Key', 'Rule Type', 'Result', 'Explanation', 'Evaluation Date']
  const escapeCsv = (str: string) => `"${(str ?? '').replace(/"/g, '""')}"`

  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      [
        escapeCsv(r.entityName),
        escapeCsv(r.entityCategory),
        escapeCsv(r.ruleKey),
        escapeCsv(r.ruleType),
        escapeCsv(r.result),
        escapeCsv(r.explanation),
        escapeCsv(r.evaluationDate),
      ].join(','),
    ),
  ].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function exportHeatmapToPng(tableElement: HTMLElement, filename = 'compliance-heatmap.png'): void {
  const rect = tableElement.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(rect.width * 2, 3840)
  canvas.height = Math.min(rect.height * 2, 2160)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(2, 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, rect.width, rect.height)

  // Render title banner onto canvas
  ctx.fillStyle = '#116466'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('ClauseTrace — Compliance Matrix Heatmap Snapshot', 20, 30)

  ctx.fillStyle = '#586b66'
  ctx.font = '12px sans-serif'
  ctx.fillText(`Generated: ${new Date().toLocaleString()} · IFSCA GIFT City RegTech Framework`, 20, 50)

  // Draw grid representation
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
}
