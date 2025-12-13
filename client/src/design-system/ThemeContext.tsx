/**
 * Theme Context and Provider
 *
 * Provides theme management (light/dark mode) with persistence
 * and system preference detection.
 */

import { createContext, useEffect, useState, ReactNode } from 'react'

import { type Theme } from './tokens'
import { isValidTheme } from './types'

export interface ThemeContextType {
	theme: Theme
	setTheme: (theme: Theme) => void
	toggleTheme: () => void
	systemPreference: Theme
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'constellate-theme'

/**
 * Get system theme preference
 */
function getSystemTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'light'
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeProviderProps {
	children: ReactNode
	defaultTheme?: Theme
	storageKey?: string
}

/**
 * Theme Provider Component
 *
 * Manages theme state and applies theme class to document root.
 * Persists theme preference to localStorage.
 */
export function ThemeProvider({
	children,
	defaultTheme,
	storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
	// Use lazy initializer to access storageKey
	const [theme, setThemeState] = useState<Theme>((): Theme => {
		if (defaultTheme) {
			return defaultTheme
		}

		if (typeof window === 'undefined') {
			return 'light'
		}

		try {
			const stored = localStorage.getItem(storageKey)
			if (stored && isValidTheme(stored)) {
				return stored
			}
		} catch (_e) {
			// localStorage is not available, proceed to system theme.
		}

		return getSystemTheme()
	})
	const [systemPreference, setSystemPreference] = useState<Theme>(() => getSystemTheme())

	// Apply theme class to document root
	useEffect(() => {
		if (typeof document === 'undefined') {
			return
		}
		const root = document.documentElement
		root.classList.remove('light', 'dark')
		root.classList.add(theme)
	}, [theme])

	// Listen for system theme changes
	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

		const handleChange = (e: MediaQueryListEvent) => {
			const newPreference: Theme = e.matches ? 'dark' : 'light'
			setSystemPreference(newPreference)

			// Only update theme if no explicit preference is stored
			try {
				const stored = localStorage.getItem(storageKey)
				if (!stored) {
					setThemeState(newPreference)
				}
			} catch (_e) {
				// localStorage is not available, update theme to system preference
				setThemeState(newPreference)
			}
		}

		mediaQuery.addEventListener('change', handleChange)
		return () => mediaQuery.removeEventListener('change', handleChange)
	}, [storageKey])

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme)
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(storageKey, newTheme)
			} catch (_e) {
				// localStorage is not available.
			}
		}
	}

	const toggleTheme = () => {
		setTheme(theme === 'light' ? 'dark' : 'light')
	}

	return (
		<ThemeContext.Provider
			value={{
				theme,
				setTheme,
				toggleTheme,
				systemPreference,
			}}>
			{children}
		</ThemeContext.Provider>
	)
}
