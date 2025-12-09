/**
 * Tests for ThemeToggle Component
 * 
 * Tests that the toggle button renders correctly, calls toggleTheme when clicked,
 * and displays the correct icon and label for each theme state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../design-system/ThemeContext'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle Component', () => {
  let localStorageMock: {
    getItem: ReturnType<typeof vi.fn>
    setItem: ReturnType<typeof vi.fn>
    removeItem: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Reset localStorage
    localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    global.localStorage = localStorageMock as any

    // Reset document classes
    document.documentElement.className = ''
  })

  describe('Component Structure', () => {
    it('should render ThemeToggle component', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('Theme State Display', () => {
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
      expect(button).toHaveAttribute('title', 'Current theme: light')
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
      expect(button).toHaveAttribute('title', 'Current theme: dark')
    })
  })

  describe('Accessibility', () => {
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

    it('should have title attribute with current theme', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Current theme: light')
    })
  })

  describe('Theme Toggle Functionality', () => {
    it('should call toggleTheme when button is clicked', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      
      // Initially light theme
      expect(button).toHaveTextContent('🌙')
      expect(button).toHaveTextContent('Dark')
      expect(document.documentElement.classList.contains('light')).toBe(true)

      // Click to toggle
      fireEvent.click(button)

      // Should now be dark theme
      expect(button).toHaveTextContent('☀️')
      expect(button).toHaveTextContent('Light')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('should toggle from light to dark', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('🌙')
      expect(document.documentElement.classList.contains('light')).toBe(true)

      fireEvent.click(button)

      expect(button).toHaveTextContent('☀️')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should toggle from dark to light', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('☀️')
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      fireEvent.click(button)

      expect(button).toHaveTextContent('🌙')
      expect(document.documentElement.classList.contains('light')).toBe(true)
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

  describe('Styling and Classes', () => {
    it('should have correct CSS classes', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex')
      expect(button).toHaveClass('items-center')
      expect(button).toHaveClass('gap-2')
      expect(button).toHaveClass('px-3')
      expect(button).toHaveClass('py-2')
      expect(button).toHaveClass('rounded-lg')
      expect(button).toHaveClass('border')
      expect(button).toHaveClass('transition-colors')
    })

    it('should have responsive label visibility', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      const label = button.querySelector('.hidden.sm\\:inline')
      expect(label).toBeInTheDocument()
    })
  })

  describe('Icon Display', () => {
    it('should show moon icon for light theme', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      const icon = button.querySelector('.text-lg')
      expect(icon).toHaveTextContent('🌙')
    })

    it('should show sun icon for dark theme', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      const icon = button.querySelector('.text-lg')
      expect(icon).toHaveTextContent('☀️')
    })
  })

  describe('Label Display', () => {
    it('should show "Dark" label for light theme', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Dark')
    })

    it('should show "Light" label for dark theme', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('Light')
    })
  })
})
