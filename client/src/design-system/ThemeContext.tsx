/**
 * Theme Context and Provider
 *
 * Provides theme management (light/dark mode) with persistence
 * and system preference detection.
 *
 * SINGLE SOURCE OF TRUTH:
 * 1. If user has explicitly set a theme preference (stored in localStorage), use that
 * 2. Otherwise, use system preference (follows OS/browser setting)
 * 3. When user makes an explicit choice, it overrides system preference
 * 4. If user clears their choice, it falls back to system preference
 */

import { createContext, useEffect, useState, ReactNode } from 'react'

import { type Theme } from './tokens'
import { isValidTheme } from './types'

export interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    systemPreference: Theme
    hasUserPreference: boolean
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
 *
 * SINGLE SOURCE OF TRUTH IMPLEMENTATION:
 * - If user has explicit preference (stored in localStorage), use that
 * - Otherwise, use system preference
 * - When user makes explicit choice, it overrides system preference
 * - If user clears choice, falls back to system preference
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
    const [hasUserPreference, setHasUserPreference] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false
        }

        try {
            const stored = localStorage.getItem(storageKey)
            return Boolean(stored && isValidTheme(stored))
        } catch (_e) {
            return false
        }
    })

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
                hasUserPreference,
            }}>
            {children}
        </ThemeContext.Provider>
    )
}
