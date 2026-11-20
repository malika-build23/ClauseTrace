import { Sun, Moon, Laptop } from 'lucide-react'
import { useTheme, type Theme } from '../../lib/theme'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Theme: ${theme} (click to cycle)`}
      aria-label={`Toggle color theme. Current theme is ${theme}`}
      className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-ink shadow-2xs hover:border-brand transition-colors"
    >
      {theme === 'light' && <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />}
      {theme === 'dark' && <Moon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />}
      {theme === 'system' && <Laptop className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
      <span className="capitalize">{theme}</span>
    </button>
  )
}
