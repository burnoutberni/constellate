import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TosAcceptanceModal } from '../../components/TosAcceptanceModal'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock fetch
global.fetch = vi.fn()

// Mock useAuth hook
const mockCheckTosStatus = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => ({
		checkTosStatus: mockCheckTosStatus,
	}),
}))

// Mock api client
vi.mock('../../lib/api-client', () => ({
	api: {
		post: vi.fn(),
	},
}))

// Mock logger
vi.mock('../../lib/logger', () => ({
	createLogger: () => ({
		error: vi.fn(),
	}),
}))

const { wrapper, queryClient } = createTestWrapper()

describe('TosAcceptanceModal Component', () => {
	let mockApiPost: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockCheckTosStatus.mockClear()
		mockCheckTosStatus.mockResolvedValue(undefined)

		// Get the mocked api
		const apiModule = await import('../../lib/api-client')
		mockApiPost = vi.mocked(apiModule.api.post)
	})

	afterEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	it('should render modal when open', () => {
		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		expect(screen.getByText('Terms of Service Update')).toBeInTheDocument()
		expect(
			screen.getByText(/Please review and accept the updated Terms of Service/i)
		).toBeInTheDocument()
		expect(screen.getByRole('checkbox')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Accept and Continue/i })).toBeInTheDocument()
	})

	it('should not render when closed', () => {
		render(<TosAcceptanceModal isOpen={false} />, { wrapper })

		expect(screen.queryByText('Terms of Service Update')).not.toBeInTheDocument()
	})

	it('should show error when submitting without accepting ToS', async () => {
		const user = userEvent.setup()
		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		const submitButton = screen.getByRole('button', { name: /Accept and Continue/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(
				screen.getByText(/You must agree to the Terms of Service and Privacy Policy/i)
			).toBeInTheDocument()
		})

		expect(mockApiPost).not.toHaveBeenCalled()
		expect(mockCheckTosStatus).not.toHaveBeenCalled()
	})

	it('should accept ToS and call checkTosStatus on success', async () => {
		const user = userEvent.setup()
		mockApiPost.mockResolvedValue({})

		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		const submitButton = screen.getByRole('button', { name: /Accept and Continue/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(mockApiPost).toHaveBeenCalledWith(
				'/tos/accept',
				{},
				undefined,
				'Failed to accept Terms of Service'
			)
		})

		await waitFor(() => {
			expect(mockCheckTosStatus).toHaveBeenCalledTimes(1)
		})
	})

	it('should show error message when API call fails', async () => {
		const user = userEvent.setup()
		const errorMessage = 'Network error'
		mockApiPost.mockRejectedValue(new Error(errorMessage))

		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		const submitButton = screen.getByRole('button', { name: /Accept and Continue/i })
		await user.click(submitButton)

		await waitFor(() => {
			// extractErrorMessage will extract the error message from the Error object
			expect(screen.getByText(errorMessage)).toBeInTheDocument()
		})

		expect(mockCheckTosStatus).not.toHaveBeenCalled()
	})

	it('should disable submit button while loading', async () => {
		const user = userEvent.setup()
		// Create a promise that we can control
		let resolvePromise: (() => void) | undefined
		const controlledPromise = new Promise<void>((resolve) => {
			resolvePromise = resolve
		})
		mockApiPost.mockReturnValue(controlledPromise)

		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		const submitButton = screen.getByRole('button', { name: /Accept and Continue/i })
		await user.click(submitButton)

		// Button should be disabled while loading
		await waitFor(() => {
			expect(submitButton).toBeDisabled()
		})

		// Resolve the promise
		if (resolvePromise) {
			resolvePromise()
		}
		await waitFor(() => {
			expect(mockCheckTosStatus).toHaveBeenCalled()
		})
	})

	it('should reset error when submitting again after error', async () => {
		const user = userEvent.setup()
		const firstError = 'First error'
		mockApiPost.mockRejectedValueOnce(new Error(firstError)).mockResolvedValueOnce({})

		render(<TosAcceptanceModal isOpen={true} />, { wrapper })

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		const submitButton = screen.getByRole('button', { name: /Accept and Continue/i })

		// First submission - should fail
		await user.click(submitButton)
		await waitFor(() => {
			expect(screen.getByText(firstError)).toBeInTheDocument()
		})

		// Second submission - should succeed
		await user.click(submitButton)
		await waitFor(() => {
			expect(mockCheckTosStatus).toHaveBeenCalled()
		})
	})
})
