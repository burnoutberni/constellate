/**
 * Theme Toggle Component
 * 
 * Allows users to switch between light and dark themes.
 * Demonstrates usage of useTheme and useThemeColors hooks.
 */

import { useTheme, useThemeColors } from '../design-system'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const colors = useThemeColors()

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
      style={{
        backgroundColor: colors.background.secondary,
        borderColor: colors.border.default,
        color: colors.text.primary,
      }}
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
