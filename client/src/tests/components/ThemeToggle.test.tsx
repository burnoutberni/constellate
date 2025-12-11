import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../../design-system'
import { ThemeToggle } from '../../components/ThemeToggle'

describe('ThemeToggle Component', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    global.localStorage = localStorageMock as unknown as Storage
    document.documentElement.className = ''
  })

  it('should render ThemeToggle component', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('should display dark mode icon and label when theme is light', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('🌙')
    expect(button).toHaveTextContent('Dark')
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('should display light mode icon and label when theme is dark', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('☀️')
    expect(button).toHaveTextContent('Light')
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  it('should have correct aria-label for light theme', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('should have correct aria-label for dark theme', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  it('should toggle theme when button is clicked', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    
    // Initially light theme
    expect(button).toHaveTextContent('🌙')
    expect(button).toHaveTextContent('Dark')

    // Click to toggle
    fireEvent.click(button)

    // Should now be dark theme
    expect(button).toHaveTextContent('☀️')
    expect(button).toHaveTextContent('Light')
  })

  it('should toggle from light to dark', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('🌙')

    fireEvent.click(button)

    expect(button).toHaveTextContent('☀️')
  })

  it('should toggle from dark to light', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('☀️')

    fireEvent.click(button)

    expect(button).toHaveTextContent('🌙')
  })

  it('should persist theme change to localStorage', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(localStorageMock.setItem).toHaveBeenCalledWith('constellate-theme', 'dark')
  })
})
