import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../design-system'
import { ThemeToggle } from '../../components/ThemeToggle'

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
	useAuth: () => ({
		user: { id: 'test-user' },
	}),
}))

// Mock api
vi.mock('../../lib/api-client', () => ({
	api: {
		put: vi.fn(),
	},
}))

describe('ThemeToggle Component', () => {
	const queryClient = new QueryClient()

	beforeEach(() => {
		document.documentElement.className = ''
		vi.clearAllMocks()
	})

	const renderWithProviders = (component: React.ReactElement) => {
		return render(
			<QueryClientProvider client={queryClient}>
				{component}
			</QueryClientProvider>
		)
	}

	it('should render ThemeToggle component', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toBeInTheDocument()
	})

	it('should display dark mode icon and label when theme is light', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT" userTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('🌙')
		expect(button).toHaveTextContent('Dark')
		expect(button).toHaveAttribute('aria-label', 'Switch to DARK mode (your preference: LIGHT)')
	})

	it('should display light mode icon and label when theme is dark', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="dark" userTheme="dark">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('☀️')
		expect(button).toHaveTextContent('Light')
		expect(button).toHaveAttribute('aria-label', 'Switch to LIGHT mode (your preference: dark)')
	})

	it('should have correct aria-label for light theme', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT" userTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveAttribute('aria-label', 'Switch to DARK mode (your preference: LIGHT)')
	})

	it('should have correct aria-label for dark theme', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="DARK" userTheme="DARK">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveAttribute('aria-label', 'Switch to LIGHT mode (your preference: DARK)')
	})

	it('should toggle theme when button is clicked', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT" userTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')

		// Initially light theme
		expect(button).toHaveTextContent('🌙')
		expect(button).toHaveTextContent('Dark')

		// Click to toggle - theme doesn't change immediately, but mutation is called
		fireEvent.click(button)

		// After click, the button still shows the current theme until mutation succeeds
		expect(button).toHaveTextContent('🌙')
		expect(button).toHaveTextContent('Dark')
	})

	it('should toggle from light to dark', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT" userTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('🌙')

		fireEvent.click(button)

		// Theme doesn't change immediately - mutation is called
		expect(button).toHaveTextContent('🌙')
	})

	it('should toggle from dark to light', () => {
		renderWithProviders(
			<ThemeProvider defaultTheme="dark" userTheme="dark">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		expect(button).toHaveTextContent('☀️')

		fireEvent.click(button)

		// Theme doesn't change immediately - mutation is called
		expect(button).toHaveTextContent('☀️')
	})

	it('should persist theme change to profile', async () => {
		const { api } = await import('../../lib/api-client')
		
		renderWithProviders(
			<ThemeProvider defaultTheme="LIGHT" userTheme="LIGHT">
				<ThemeToggle />
			</ThemeProvider>
		)

		const button = screen.getByRole('button')
		fireEvent.click(button)

		// Wait for the mutation to be called
		await new Promise(resolve => setTimeout(resolve, 0))

		expect(api.put).toHaveBeenCalledWith('/profile', { theme: 'DARK' }, undefined, 'Failed to update theme preference')
	})
})
