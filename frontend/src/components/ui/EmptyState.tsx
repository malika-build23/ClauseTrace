import type { ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  className = '',
}: {
  icon?: typeof FolderOpen
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center ${className}`}>
      <div className="rounded-full bg-brand-light p-3 text-brand">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
