import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className = '',
}: {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  breadcrumbs?: ReactNode
  className?: string
}) {
  return (
    <header className={`space-y-2 mb-6 ${className}`}>
      {breadcrumbs && <div className="text-xs text-muted mb-1">{breadcrumbs}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
