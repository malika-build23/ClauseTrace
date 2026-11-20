import { useState, type ReactNode } from 'react'

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
}: {
  content: ReactNode
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  const posClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position]

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-normal rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink shadow-lg transition-opacity duration-150 ${posClasses} max-w-xs text-center`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
