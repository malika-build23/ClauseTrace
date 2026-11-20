import { useState } from 'react'
import { apiSend, type RiskWeights } from '../lib/api'
import { useAuth } from '../lib/auth'

const FIELDS: { key: keyof RiskWeights; label: string }[] = [
  { key: 'fail', label: 'Check fails' },
  { key: 'overdue', label: 'Deadline missed' },
  { key: 'upcoming', label: 'Deadline inside its window' },
  { key: 'upcomingPerDayInside', label: '… plus per day closer to the due date' },
  { key: 'insufficient', label: 'Missing or unusable data' },
  { key: 'pendingChange', label: 'Source clause changed, not reviewed' },
  { key: 'highThreshold', label: 'Score for "high"' },
  { key: 'mediumThreshold', label: 'Score for "medium"' },
]

/** Transparent risk scoring: everyone can see the weights; admins can change them. */
export function RiskSettings({ weights, onSaved }: { weights: RiskWeights; onSaved: () => void }) {
  const { can } = useAuth()
  const [draft, setDraft] = useState(weights)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editable = can('admin')
  const dirty = JSON.stringify(draft) !== JSON.stringify(weights)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await apiSend('PUT', '/api/risk-config', { weights: draft })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <summary className="cursor-pointer font-medium">How risk is scored</summary>
      <p className="mt-2 text-sm text-muted">
        Each latest result gets points for the factors below; the reasons are shown next to every score. This orders the list. It
        is not a compliance judgement.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <dt className="text-muted">{f.label}</dt>
            <dd>
              {editable ? (
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  aria-label={f.label}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                  className="w-20 rounded-md border border-line px-2 py-1 text-right text-sm"
                />
              ) : (
                <span className="tabular-nums">{weights[f.key]}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>}
      {editable && (
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save weights'}
        </button>
      )}
    </details>
  )
}
