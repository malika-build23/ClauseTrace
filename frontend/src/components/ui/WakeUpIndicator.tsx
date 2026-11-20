import { useEffect, useState } from 'react'
import { Server, X } from 'lucide-react'
import { subscribeWakeUp } from '../../lib/api'

export function WakeUpIndicator() {
  const [waking, setWaking] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return subscribeWakeUp((isSlow) => {
      setWaking(isSlow)
      if (isSlow) setDismissed(false)
    })
  }, [])

  if (!waking || dismissed) return null

  return (
    <aside
      aria-label="Server status notice"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs flex items-center justify-between transition-all"
    >
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 animate-pulse text-upcoming" aria-hidden="true" />
        <span className="font-semibold">ClauseTrace Server Warming Up:</span>
        <span>
          Backend instances on free tier sleep after inactivity and take up to 45–60 seconds to wake. Please wait…
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-amber-500/20 rounded"
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  )
}
