/**
 * Theme Toggle Component
 *
 * Allows users to switch between light and dark themes.
 * Uses Tailwind utility classes with theme-aware semantic colors.
 *
 * FEATURES:
 * - Shows current theme (light/dark)
 * - Shows system preference when user hasn't made a choice
 * - Allows user to override system preference
 * - Uses proper accessibility labels
 */

import { useTheme } from '@/design-system'

import { Button } from './ui'

export function ThemeToggle() {
    const { theme, toggleTheme, systemPreference, hasUserPreference } = useTheme()

    const getToggleLabel = () => {
        if (!hasUserPreference) {
            return `Switch to ${theme === 'light' ? 'dark' : 'light'} mode (current: ${theme}, system: ${systemPreference})`
        }
        return `Switch to ${theme === 'light' ? 'dark' : 'light'} mode (your preference: ${theme})`
    }

    const getTitle = () => {
        if (!hasUserPreference) {
            return `Current: ${theme} (following system: ${systemPreference}). Click to override.`
        }
        return `Current theme: ${theme} (your preference). Click to switch.`
    }

    return (
        <Button
            onClick={toggleTheme}
            variant="secondary"
            size="sm"
            aria-label={getToggleLabel()}
            title={getTitle()}>
            <span className="text-lg">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span className="text-sm font-medium hidden sm:inline">
                {theme === 'light' ? 'Dark' : 'Light'}
            </span>
            {!hasUserPreference && (
                <span className="text-xs text-text-tertiary hidden md:inline ml-1">
                    (Auto)
                </span>
            )}
        </Button>
    )
}
