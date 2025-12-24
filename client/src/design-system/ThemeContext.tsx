/**
 * Theme Context and Provider
 *
 * Provides theme management (light/dark mode) with persistence
 * and system preference detection.
 *
 * SINGLE SOURCE OF TRUTH:
 * 1. If user has explicitly set a theme preference (stored in database), use that
 * 2. Otherwise, use system preference (follows OS/browser setting)
 * 3. When user makes an explicit choice, it overrides system preference
 * 4. If user clears their choice, it falls back to system preference
 */

import { createContext, useEffect, useState, ReactNode } from 'react'

import { type Theme } from './tokens'

export interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    systemPreference: Theme
    hasUserPreference: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Get system theme preference
 */
function getSystemTheme(): Theme {
    if (typeof window === 'undefined') {
        return 'LIGHT'
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT'
}

interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: Theme
    storageKey?: string
    userTheme?: Theme | null
}

/**
 * Theme Provider Component
 *
 * Manages theme state and applies theme class to document root.
 *
 * SINGLE SOURCE OF TRUTH IMPLEMENTATION:
 * - If user has explicit preference (stored in database), use that
 * - Otherwise, use system preference
 * - When user makes explicit choice, it overrides system preference
 * - If user clears choice, falls back to system preference
 */
export function ThemeProvider({
    children,
    defaultTheme,
    userTheme,
}: ThemeProviderProps) {
    // Use lazy initializer to access storageKey
    const [theme, setThemeState] = useState<Theme>((): Theme => {
        // If user has set a theme in their profile, use that
        if (userTheme) {
            return userTheme
        }

        if (defaultTheme) {
            return defaultTheme
        }

        if (typeof window === 'undefined') {
            return 'LIGHT'
        }

        return getSystemTheme()
    })
    const [systemPreference, setSystemPreference] = useState<Theme>(() => getSystemTheme())
    const [hasUserPreference, setHasUserPreference] = useState<boolean>(() => Boolean(userTheme))

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
            const newPreference: Theme = e.matches ? 'DARK' : 'LIGHT'
            setSystemPreference(newPreference)

            // Only update theme if user hasn't made an explicit choice
            if (!hasUserPreference) {
                setThemeState(newPreference)
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [hasUserPreference])

    const setTheme = (newTheme: Theme) => {
        // User is making an explicit choice
        setHasUserPreference(true)
        setThemeState(newTheme)
    }

    const toggleTheme = () => {
        setTheme(theme === 'LIGHT' ? 'DARK' : 'LIGHT')
    }

    return (
        <ThemeContext.Provider
            value={{
                theme,
                setTheme,
                toggleTheme,
                systemPreference,
                hasUserPreference,
            }}>
            {children}
        </ThemeContext.Provider>
    )
}
