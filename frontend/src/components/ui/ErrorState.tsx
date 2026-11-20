import { AlertCircle, RefreshCw } from 'lucide-react'

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-fail-border bg-fail-bg/60 p-5 text-fail ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-fail mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-fail">{title}</h4>
          <p className="mt-1 text-xs text-muted leading-relaxed break-words">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-fail-border bg-panel px-3 py-1.5 text-xs font-semibold text-fail shadow-xs hover:bg-fail-bg transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
