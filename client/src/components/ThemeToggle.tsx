/**
 * Theme Toggle Component
 *
 * Allows users to switch between light and dark themes.
 * Uses Tailwind utility classes with theme-aware semantic colors.
 */

import { useTheme } from '@/design-system'

import { Button } from './ui'

export function ThemeToggle() {
	const { theme, toggleTheme } = useTheme()

	return (
		<Button
			onClick={toggleTheme}
			variant="secondary"
			size="sm"
			aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
			title={`Current theme: ${theme}`}>
			<span className="text-lg">{theme === 'light' ? '🌙' : '☀️'}</span>
			<span className="text-sm font-medium hidden sm:inline">
				{theme === 'light' ? 'Dark' : 'Light'}
			</span>
		</Button>
	)
}
