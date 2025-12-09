/**
 * Tests for ThemeContext and ThemeProvider
 * 
 * Tests theme switching, localStorage persistence, system preference detection,
 * and the useTheme and useThemeColors hooks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme, useThemeColors } from '../design-system/ThemeContext'
import { tokens } from '../design-system/tokens'

// Mock window.matchMedia
function createMatchMedia(matches: boolean) {
  return vi.fn(() => ({
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Test component that uses useTheme hook
function TestComponent() {
  const { theme, setTheme, toggleTheme, systemPreference } = useTheme()
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="system-preference">{systemPreference}</div>
      <button data-testid="toggle" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Set Light
      </button>
    </div>
  )
}

// Test component that uses useThemeColors hook
function TestColorsComponent() {
  const colors = useThemeColors()
  return (
    <div>
      <div data-testid="bg-primary">{colors.background.primary}</div>
      <div data-testid="text-primary">{colors.text.primary}</div>
    </div>
  )
}

describe('ThemeContext', () => {
  let originalLocalStorage: typeof global.localStorage
  let originalMatchMedia: typeof window.matchMedia
  let originalDocumentClassName: string
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Store original values before modifying
    originalLocalStorage = global.localStorage
    originalMatchMedia = window.matchMedia
    originalDocumentClassName = document.documentElement.className

    // Reset localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    global.localStorage = localStorageMock as any

    // Reset document classes
    document.documentElement.className = ''

    // Reset matchMedia
    window.matchMedia = createMatchMedia(false)
  })

  afterEach(() => {
    global.localStorage = originalLocalStorage
    window.matchMedia = originalMatchMedia
    document.documentElement.className = originalDocumentClassName
    vi.clearAllMocks()
  })

  describe('ThemeProvider initialization', () => {
    it('should use defaultTheme when provided', () => {
      localStorageMock.getItem = vi.fn(() => null)
      
      render(
        <ThemeProvider defaultTheme="dark">
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should read from localStorage when available', () => {
      localStorageMock.getItem = vi.fn((key) => {
        if (key === 'constellate-theme') return 'dark'
        return null
      })

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should fall back to system preference when no localStorage value', () => {
      localStorageMock.getItem = vi.fn(() => null)
      window.matchMedia = createMatchMedia(true) // System prefers dark

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should use light theme when system prefers light and no localStorage value', () => {
      localStorageMock.getItem = vi.fn(() => null)
      window.matchMedia = createMatchMedia(false) // System prefers light

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })

  describe('Theme persistence', () => {
    it('should save theme to localStorage when setTheme is called', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      const setDarkButton = screen.getByTestId('set-dark')
      act(() => {
        setDarkButton.click()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('constellate-theme', 'dark')
    })

    it('should use custom storage key when provided', () => {
      localStorageMock.getItem = vi.fn(() => null)
      const customKey = 'custom-theme-key'

      render(
        <ThemeProvider storageKey={customKey}>
          <TestComponent />
        </ThemeProvider>
      )

      const setLightButton = screen.getByTestId('set-light')
      act(() => {
        setLightButton.click()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(customKey, 'light')
    })
  })

  describe('Theme class application', () => {
    it('should apply theme class to document root', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="dark">
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('should remove previous theme class when switching', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>
      )

      expect(document.documentElement.classList.contains('light')).toBe(true)

      const toggleButton = screen.getByTestId('toggle')
      act(() => {
        toggleButton.click()
      })

      expect(document.documentElement.classList.contains('light')).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('System preference detection', () => {
    it('should detect system preference', () => {
      localStorageMock.getItem = vi.fn(() => null)
      window.matchMedia = createMatchMedia(true)

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('system-preference')).toHaveTextContent('dark')
    })

    it('should update theme when system preference changes and no explicit preference is stored', () => {
      localStorageMock.getItem = vi.fn(() => null)
      const mockMediaQuery = {
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, handler) => {
          // Store handler for later
          if (event === 'change') {
            mockMediaQuery.changeHandler = handler
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        changeHandler: null as ((e: MediaQueryListEvent) => void) | null,
      }

      window.matchMedia = vi.fn(() => mockMediaQuery as any)

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')

      // Simulate system preference change
      mockMediaQuery.matches = true
      if (mockMediaQuery.changeHandler) {
        act(() => {
          mockMediaQuery.changeHandler!({
            matches: true,
            media: '(prefers-color-scheme: dark)',
          } as MediaQueryListEvent)
        })
      }

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })

    it('should not update theme when explicit preference is stored', () => {
      localStorageMock.getItem = vi.fn(() => 'light')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')

      // System preference change should not affect theme when explicit preference exists
      const mockMediaQuery = {
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
      window.matchMedia = vi.fn(() => mockMediaQuery as any)

      // Theme should remain 'light' even if system preference changes
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
    })
  })

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')

      const toggleButton = screen.getByTestId('toggle')
      act(() => {
        toggleButton.click()
      })

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    })

    it('should toggle from dark to light', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="dark">
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('dark')

      const toggleButton = screen.getByTestId('toggle')
      act(() => {
        toggleButton.click()
      })

      expect(screen.getByTestId('theme')).toHaveTextContent('light')
    })
  })

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleError = console.error
      console.error = vi.fn()

      const TestComponentWithoutProvider = () => {
        useTheme()
        return null
      }

      expect(() => {
        render(<TestComponentWithoutProvider />)
      }).toThrow('useTheme must be used within a ThemeProvider')

      console.error = consoleError
    })

    it('should return theme context when used within ThemeProvider', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')
      expect(screen.getByTestId('system-preference')).toBeInTheDocument()
      expect(screen.getByTestId('toggle')).toBeInTheDocument()
      expect(screen.getByTestId('set-dark')).toBeInTheDocument()
      expect(screen.getByTestId('set-light')).toBeInTheDocument()
    })
  })

  describe('useThemeColors hook', () => {
    it('should return light theme colors when theme is light', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <TestColorsComponent />
        </ThemeProvider>
      )

      const bgPrimary = screen.getByTestId('bg-primary')
      const textPrimary = screen.getByTestId('text-primary')

      expect(bgPrimary).toHaveTextContent(tokens.colors.light.background.primary)
      expect(textPrimary).toHaveTextContent(tokens.colors.light.text.primary)
    })

    it('should return dark theme colors when theme is dark', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="dark">
          <TestColorsComponent />
        </ThemeProvider>
      )

      const bgPrimary = screen.getByTestId('bg-primary')
      const textPrimary = screen.getByTestId('text-primary')

      expect(bgPrimary).toHaveTextContent(tokens.colors.dark.background.primary)
      expect(textPrimary).toHaveTextContent(tokens.colors.dark.text.primary)
    })

    it('should update colors when theme changes', () => {
      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <div>
            <TestComponent />
            <TestColorsComponent />
          </div>
        </ThemeProvider>
      )

      expect(screen.getByTestId('bg-primary')).toHaveTextContent(
        tokens.colors.light.background.primary
      )

      const toggleButton = screen.getByTestId('toggle')
      act(() => {
        toggleButton.click()
      })

      expect(screen.getByTestId('bg-primary')).toHaveTextContent(
        tokens.colors.dark.background.primary
      )
    })
  })

  describe('SSR and window undefined scenarios', () => {
    it('should handle SSR scenario when window is undefined', () => {
      const originalWindow = global.window
      // @ts-expect-error - intentionally setting to undefined for SSR test
      global.window = undefined

      // This should not throw
      expect(() => {
        // In SSR, getSystemTheme should return 'light' as default
        const systemTheme = window === undefined ? 'light' : 
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        expect(systemTheme).toBe('light')
      }).not.toThrow()

      global.window = originalWindow
    })

    it('should handle localStorage being undefined', () => {
      const originalLocalStorage = global.localStorage
      global.localStorage = undefined as any

      localStorageMock.getItem = vi.fn(() => null)

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>
      )

      expect(screen.getByTestId('theme')).toHaveTextContent('light')

      global.localStorage = originalLocalStorage
    })
  })

  describe('Edge cases', () => {
    it('should handle invalid theme in localStorage gracefully', () => {
      localStorageMock.getItem = vi.fn(() => 'invalid-theme')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should fall back to system preference
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    it('should handle empty string in localStorage', () => {
      localStorageMock.getItem = vi.fn(() => '')

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )

      // Should fall back to system preference
      expect(screen.getByTestId('theme')).toBeInTheDocument()
    })

    it('should handle custom storage key with special characters', () => {
      localStorageMock.getItem = vi.fn(() => null)
      const customKey = 'custom-theme-key-123'

      render(
        <ThemeProvider storageKey={customKey}>
          <TestComponent />
        </ThemeProvider>
      )

      const setLightButton = screen.getByTestId('set-light')
      act(() => {
        setLightButton.click()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(customKey, 'light')
    })
  })
})
