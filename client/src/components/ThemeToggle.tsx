/**
 * Theme Toggle Component
 * 
 * Allows users to switch between light and dark themes.
 * Uses Tailwind utility classes with theme-aware semantic colors.
 */

import { useTheme } from '../design-system'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-default bg-background-secondary text-text-primary transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Current theme: ${theme}`}
    >
      <span className="text-lg">
        {theme === 'light' ? '🌙' : '☀️'}
      </span>
      <span className="text-sm font-medium hidden sm:inline">
        {theme === 'light' ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}
