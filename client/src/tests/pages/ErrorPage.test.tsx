import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorPage } from '../../pages/ErrorPage'
import { createTestWrapper } from '../testUtils'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom')
	return {
		...actual,
		useNavigate: () => mockNavigate,
	}
})

// Mock the environment utility to control development mode
const mockIsDevelopment = vi.fn(() => true)
vi.mock('../../lib/env', () => ({
	isDevelopment: () => mockIsDevelopment(),
}))

const { wrapper } = createTestWrapper()

describe('ErrorPage', () => {
	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()
		mockNavigate.mockClear()
		mockIsDevelopment.mockReturnValue(true) // Default to development for most tests
	})

	it('should render error page with basic content', () => {
		render(<ErrorPage />, { wrapper })

		expect(screen.getByText('Something went wrong')).toBeInTheDocument()
		expect(
			screen.getByText('An unexpected error occurred. Our team has been notified.')
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument()
	})

	it('should display error details in development environment', () => {
		mockIsDevelopment.mockReturnValue(true)

		const testError = new Error('Test error message')
		render(<ErrorPage error={testError} />, { wrapper })

		expect(screen.getByText('Error Details')).toBeInTheDocument()
		expect(screen.getByText('Test error message')).toBeInTheDocument()
		expect(screen.getByText('Error Message:')).toBeInTheDocument()
	})

	it('should not display error details in production environment', () => {
		mockIsDevelopment.mockReturnValue(false)

		const testError = new Error('Sensitive error information')
		render(<ErrorPage error={testError} />, { wrapper })

		// Error details should not be visible
		expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
		expect(screen.queryByText('Sensitive error information')).not.toBeInTheDocument()

		// But basic error page content should still be visible
		expect(screen.getByText('Something went wrong')).toBeInTheDocument()
		expect(
			screen.getByText('An unexpected error occurred. Our team has been notified.')
		).toBeInTheDocument()
	})

	it('should display component stack in development environment when errorInfo is provided', () => {
		mockIsDevelopment.mockReturnValue(true)

		const testError = new Error('Test error message')
		const errorInfo = {
			componentStack: `
    in TestComponent
    in ErrorBoundary
    in App
			`.trim(),
		}

		render(<ErrorPage error={testError} errorInfo={errorInfo} />, { wrapper })

		expect(screen.getByText('Error Details')).toBeInTheDocument()
		expect(screen.getByText('Component Stack:')).toBeInTheDocument()
		expect(screen.getByText(/in TestComponent/)).toBeInTheDocument()
		expect(screen.getByText(/in ErrorBoundary/)).toBeInTheDocument()
		expect(screen.getByText(/in App/)).toBeInTheDocument()
	})

	it('should display error stack when available', () => {
		mockIsDevelopment.mockReturnValue(true)

		const testError = new Error('Test error message')
		testError.stack = 'Error: Test error message\n    at TestComponent (test.tsx:10:5)'

		render(<ErrorPage error={testError} />, { wrapper })

		expect(screen.getByText('Error Details')).toBeInTheDocument()
		expect(screen.getByText('Error Stack:')).toBeInTheDocument()
		expect(screen.getByText(/at TestComponent/)).toBeInTheDocument()
	})

	it('should not display error details in production environment', () => {
		mockIsDevelopment.mockReturnValue(false)

		const testError = new Error('Test error message')
		const errorInfo = {
			componentStack: `
    in TestComponent
    in ErrorBoundary
    in App
			`.trim(),
		}

		render(<ErrorPage error={testError} errorInfo={errorInfo} />, { wrapper })

		expect(screen.queryByText('Error Details')).not.toBeInTheDocument()
		expect(screen.queryByText('Component Stack:')).not.toBeInTheDocument()
	})

	it('should display error message but not component stack when errorInfo is not provided', () => {
		mockIsDevelopment.mockReturnValue(true)

		const testError = new Error('Test error message')
		render(<ErrorPage error={testError} />, { wrapper })

		expect(screen.getByText('Error Details')).toBeInTheDocument()
		expect(screen.getByText('Error Message:')).toBeInTheDocument()
		expect(screen.queryByText('Component Stack:')).not.toBeInTheDocument()
	})

	it('should allow expanding and collapsing error details', async () => {
		mockIsDevelopment.mockReturnValue(true)
		const user = userEvent.setup()

		const testError = new Error('Test error message')
		const errorInfo = {
			componentStack: 'in TestComponent',
		}

		render(<ErrorPage error={testError} errorInfo={errorInfo} />, { wrapper })

		const detailsElement = screen.getByText('Error Details').closest('details')
		expect(detailsElement).toBeInTheDocument()

		// Initially collapsed (details element is closed by default)
		// Click to expand
		await user.click(screen.getByText('Error Details'))

		// Content should be visible after expanding
		expect(screen.getByText('Test error message')).toBeInTheDocument()
		expect(screen.getByText('Component Stack:')).toBeInTheDocument()
	})

	it('should call resetErrorBoundary when Try Again is clicked', async () => {
		const resetErrorBoundary = vi.fn()
		const user = userEvent.setup()

		render(<ErrorPage resetErrorBoundary={resetErrorBoundary} />, { wrapper })

		const tryAgainButton = screen.getByRole('button', { name: 'Try Again' })
		await user.click(tryAgainButton)

		expect(resetErrorBoundary).toHaveBeenCalledOnce()
	})

	it('should call resetErrorBoundary and navigate when Go Home is clicked', async () => {
		const resetErrorBoundary = vi.fn()
		const user = userEvent.setup()

		render(<ErrorPage resetErrorBoundary={resetErrorBoundary} />, { wrapper })

		const goHomeButton = screen.getByRole('button', { name: 'Go Home' })
		await user.click(goHomeButton)

		expect(resetErrorBoundary).toHaveBeenCalledOnce()
		expect(mockNavigate).toHaveBeenCalledWith('/')
	})

	it('should reload page when Try Again is clicked without resetErrorBoundary', async () => {
		const user = userEvent.setup()
		const reloadSpy = vi.fn()

		// Create a mock location object
		const mockLocation = {
			...window.location,
			reload: reloadSpy,
		}

		// Replace window.location with our mock
		Object.defineProperty(window, 'location', {
			value: mockLocation,
			writable: true,
			configurable: true,
		})

		render(<ErrorPage />, { wrapper })

		const tryAgainButton = screen.getByRole('button', { name: 'Try Again' })
		await user.click(tryAgainButton)

		expect(reloadSpy).toHaveBeenCalledOnce()
	})

	it('should navigate home when Go Home is clicked without resetErrorBoundary', async () => {
		const user = userEvent.setup()

		render(<ErrorPage />, { wrapper })

		const goHomeButton = screen.getByRole('button', { name: 'Go Home' })
		await user.click(goHomeButton)

		expect(mockNavigate).toHaveBeenCalledWith('/')
	})
})
