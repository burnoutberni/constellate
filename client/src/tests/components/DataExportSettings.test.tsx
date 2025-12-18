import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataExportSettings } from '../../components/DataExportSettings'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock fetch
global.fetch = vi.fn()

// Mock useUIStore
const mockAddToast = vi.fn()
// Type for selector function - parameter name required by TypeScript but unused
// eslint-disable-next-line no-unused-vars
type SelectorFn = (_state: { addToast: typeof mockAddToast }) => unknown
vi.mock('../../stores', () => ({
	useUIStore: (selector: SelectorFn) => {
		const mockState = {
			addToast: mockAddToast,
		}
		return selector(mockState)
	},
}))

// Mock useErrorHandler
const mockHandleError = vi.fn()
vi.mock('../../hooks/useErrorHandler', () => ({
	useErrorHandler: () => mockHandleError,
}))

// Mock api client
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

const { wrapper, queryClient } = createTestWrapper()

describe('DataExportSettings Component', () => {
	let mockApiGet: ReturnType<typeof vi.fn>
	let mockApiPost: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		// Ensure real timers are active first (in case previous test left fake timers)
		if (vi.isFakeTimers()) {
			vi.useRealTimers()
		}
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockAddToast.mockClear()
		mockHandleError.mockClear()

		// Get the mocked api
		const apiModule = await import('../../lib/api-client')
		mockApiGet = vi.mocked(apiModule.api.get)
		mockApiPost = vi.mocked(apiModule.api.post)
	})

	afterEach(() => {
		// Ensure real timers are active first (before clearing mocks)
		if (vi.isFakeTimers()) {
			vi.useRealTimers()
		}
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		// Restore any spies that might have been created
		vi.restoreAllMocks()
	})

	it('should render data export settings', () => {
		render(<DataExportSettings />, { wrapper })

		expect(screen.getByText('Data Export')).toBeInTheDocument()
		expect(
			screen.getByText(/You can download a copy of your personal data/i)
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Request Data Export/i })).toBeInTheDocument()
	})

	it('should create export job when button is clicked', async () => {
		const user = userEvent.setup()
		mockApiPost.mockResolvedValueOnce({
			exportId: 'export-123',
			status: 'PENDING',
		})

		render(<DataExportSettings />, { wrapper })

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		await user.click(button)

		expect(mockApiPost).toHaveBeenCalledWith(
			'/users/me/export',
			{},
			undefined,
			'Failed to create export'
		)
	})

	it('should show success toast when export job is created', async () => {
		const user = userEvent.setup()
		const exportResponse = {
			exportId: 'export-123',
			status: 'PENDING' as const,
		}
		// Use mockResolvedValueOnce - it should work fine
		mockApiPost.mockResolvedValueOnce(exportResponse)

		render(<DataExportSettings />, { wrapper })

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		await user.click(button)

		// Wait for API call first
		await waitFor(
			() => {
				expect(mockApiPost).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)

		// Give React time to process state updates
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Then wait for the toast to be called (toast is shown after state updates)
		// The toast is called when status is not 'COMPLETED'
		await waitFor(
			() => {
				expect(mockAddToast).toHaveBeenCalledWith(
					expect.objectContaining({
						message: 'Export job created. Processing your data...',
						variant: 'success',
					})
				)
			},
			{ timeout: 2000 }
		)
	})

	it('should show processing status when export is pending', async () => {
		const user = userEvent.setup()
		mockApiPost.mockResolvedValueOnce({
			exportId: 'export-123',
			status: 'PENDING',
		})

		render(<DataExportSettings />, { wrapper })

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		await user.click(button)

		await waitFor(() => {
			expect(screen.getByText(/⏳ Export queued.../i)).toBeInTheDocument()
		})
	})

	it('should download immediately if export is already completed', async () => {
		const user = userEvent.setup()

		mockApiPost.mockResolvedValueOnce({
			exportId: 'export-123',
			status: 'COMPLETED',
		})

		mockApiGet.mockResolvedValueOnce({
			profile: { id: 'user-1' },
			events: [],
		})

		// Render first, then set up spies for download functionality
		render(<DataExportSettings />, { wrapper })

		// Mock URL.createObjectURL and document methods using spies
		const mockCreateObjectURL = vi.fn(() => 'blob:url')
		const mockRevokeObjectURL = vi.fn()
		global.URL.createObjectURL = mockCreateObjectURL
		global.URL.revokeObjectURL = mockRevokeObjectURL

		const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
			// Mock the click method on anchor elements - ensure it doesn't throw
			if (node instanceof HTMLAnchorElement) {
				node.click = vi.fn()
			}
			return node
		})
		const removeChildSpy = vi
			.spyOn(document.body, 'removeChild')
			.mockImplementation(() => null as unknown as Node)
		const createElementSpy = vi.spyOn(document, 'createElement')

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		await user.click(button)

		// Wait for API call first
		await waitFor(
			() => {
				expect(mockApiPost).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)

		// Wait for API call first
		await waitFor(
			() => {
				expect(mockApiPost).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)

		// Wait for download API call (downloadExport is called when status is COMPLETED)
		await waitFor(
			() => {
				expect(mockApiGet).toHaveBeenCalledWith(
					'/users/me/export/export-123',
					undefined,
					undefined,
					'Failed to download export'
				)
			},
			{ timeout: 2000 }
		)

		// Give React time to process the download completion and call toast
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Then wait for toast
		await waitFor(
			() => {
				expect(mockAddToast).toHaveBeenCalledWith(
					expect.objectContaining({
						message: 'Data export downloaded successfully',
						variant: 'success',
					})
				)
			},
			{ timeout: 2000 }
		)

		// Cleanup
		appendChildSpy.mockRestore()
		removeChildSpy.mockRestore()
		createElementSpy.mockRestore()
	})

	it('should handle API errors gracefully', async () => {
		const user = userEvent.setup()
		const error = new Error('Network error')
		mockApiPost.mockRejectedValueOnce(error)

		render(<DataExportSettings />, { wrapper })

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		await user.click(button)

		// Wait for error handling
		await waitFor(
			() => {
				expect(mockApiPost).toHaveBeenCalled()
				expect(mockHandleError).toHaveBeenCalledWith(
					error,
					'Failed to create export',
					expect.objectContaining({
						context: 'DataExportSettings.handleExport',
					})
				)
			},
			{ timeout: 2000 }
		)
	})

	it('should disable button while processing', async () => {
		const user = userEvent.setup()
		// Use a promise that never resolves to test the loading state
		mockApiPost.mockImplementation(() => new Promise(() => {}))

		render(<DataExportSettings />, { wrapper })

		const button = screen.getByRole('button', { name: /Request Data Export/i })
		expect(button).not.toBeDisabled()

		await user.click(button)

		// Wait for button to become disabled (loading state)
		await waitFor(
			() => {
				// Re-query button in case component re-rendered
				const updatedButton = screen.getByRole('button', {
					name: /Request Data Export|Processing/i,
				})
				expect(updatedButton).toBeDisabled()
			},
			{ timeout: 2000 }
		)
	})
})
