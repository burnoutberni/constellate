/**
 * Theme Context and Provider
 * 
 * Provides theme management (light/dark mode) with persistence
 * and system preference detection.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Theme } from './tokens'
import { tokens } from './tokens'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  systemPreference: Theme
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

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
  const [theme, setThemeState] = useState<Theme>(() => {
    if (defaultTheme) {
      return defaultTheme
    }
    
    if (typeof window === 'undefined') {
      return 'light'
    }
    
    const stored = localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
    
    return getSystemTheme()
  })
  const [systemPreference, setSystemPreference] = useState<Theme>(getSystemTheme)

  // Apply theme class to document root
  useEffect(() => {
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
      const stored = localStorage.getItem(storageKey)
      if (!stored) {
        setThemeState(newPreference)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [storageKey])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newTheme)
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

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
 */
export function useThemeColors() {
  const { theme } = useTheme()
  return tokens.colors[theme]
}
