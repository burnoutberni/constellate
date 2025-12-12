import { useContext } from 'react'
import { ThemeContext, tokens, type ThemeContextType } from '@/design-system'

/**
 * Hook to access theme context
 *
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextType {
	const context = useContext(ThemeContext)

	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider')
	}

	return context
}

/**
 * Hook to get current theme colors
 *
 * Returns the color tokens for the current theme.
 *
 * @public
 * Part of the design system public API. Use this hook to access
 * theme-aware colors in your components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useThemeColors()
 *   return <div style={{ color: colors.text.primary }}>Themed text</div>
 * }
 * ```
 */
export function useThemeColors() {
	const { theme } = useTheme()
	return tokens.colors[theme as 'light' | 'dark']
}
