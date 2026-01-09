import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarPage } from '../../pages/CalendarPage'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockEvent: Event = {
	id: 'event1',
	title: 'Test Event',
	summary: 'Test summary',
	location: 'Test Location',
	startTime: '2024-01-15T10:00:00Z',
	endTime: '2024-01-15T12:00:00Z',
	visibility: 'PUBLIC',
	tags: [],
	timezone: 'UTC',
	user: {
		id: 'user1',
		username: 'testuser',
		name: 'Test User',
		isRemote: false,
	},
	_count: {
		attendance: 10,
		likes: 5,
		comments: 3,
	},
}

const mockUseRealtime = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => ({
		user: mockUser,
		loading: false,
		login: vi.fn(),
		sendMagicLink: vi.fn(),
		signup: vi.fn(),
		logout: vi.fn(),
	}),
}))

vi.mock('../../hooks/useRealtime', () => ({
	useRealtime: () => mockUseRealtime(),
}))

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom')
	return {
		...actual,
		useNavigate: () => mockNavigate,
	}
})

const { mockAddToast } = vi.hoisted(() => ({
	mockAddToast: vi.fn(),
}))

vi.mock('../../stores', () => ({
	useUIStore: (
		// eslint-disable-next-line no-unused-vars
		selector?: (_state: {
			addToast: unknown
			setIsFeedRefreshing: unknown
		}) => unknown
	) => {
		const state = {
			addToast: mockAddToast,
			setIsFeedRefreshing: vi.fn(),
		}
		if (selector) {
			return selector(state)
		}
		return state
	},
}))

global.fetch = vi.fn()

const { wrapper, queryClient } = createTestWrapper(['/calendar'])

describe('CalendarPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		// Reset window mock between tests
		vi.mocked(mockAddToast).mockClear()

		mockUseRealtime.mockReturnValue({
			isConnected: true,
		})
			// Mock fetch to handle both attendance and events calls
			; (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {

				if (url.includes('/api/events')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ events: [] }),
					} as Response)
				}
				return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
			})
	})
	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should render calendar page', async () => {
		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				// "Upcoming Events" may appear multiple times
				expect(screen.getAllByText(/Upcoming Events/i).length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)
	})

	it('should switch between month, week, and day views', async () => {
		const user = userEvent.setup()
		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText(/Upcoming Events/i).length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for view switcher buttons
		const viewButtons = screen
			.getAllByRole('button')
			.filter(
				(btn) =>
					btn.textContent?.includes('Month') ||
					btn.textContent?.includes('Week') ||
					btn.textContent?.includes('Day')
			)

		expect(viewButtons.length).toBeGreaterThan(0)
		if (viewButtons.length > 0) {
			await user.click(viewButtons[0])
			// After clicking, buttons should still be present
			expect(
				screen
					.getAllByRole('button')
					.filter(
						(btn) =>
							btn.textContent?.includes('Month') ||
							btn.textContent?.includes('Week') ||
							btn.textContent?.includes('Day')
					).length
			).toBeGreaterThan(0)
		}
	})

	it('should display upcoming events sidebar', async () => {
		const todayEvent = {
			...mockEvent,
			startTime: new Date().toISOString(),
		}

			; (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {

				if (url.includes('/api/events')) {
					return Promise.resolve({
						ok: true,
						json: async () => ({ events: [todayEvent] }),
					} as Response)
				}
				return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
			})

		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				// "Upcoming Events" may appear multiple times
				expect(screen.getAllByText(/Upcoming Events/i).length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)
	})

	it('should handle calendar export', async () => {
		; (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {

			if (url.includes('/api/events')) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ events: [] }),
				} as Response)
			}
			return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
		})

		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Export My Calendar')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Check that export link is present
		expect(screen.getByText('Get Private Feed URL')).toBeInTheDocument()
	})

	it('should handle date navigation', async () => {
		const user = userEvent.setup()
		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText(/Upcoming Events/i).length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for navigation buttons (Previous/Next or arrow buttons)
		const navButtons = screen
			.getAllByRole('button')
			.filter(
				(btn) =>
					btn.textContent?.includes('Previous') ||
					btn.textContent?.includes('Next') ||
					btn.getAttribute('aria-label')?.includes('previous') ||
					btn.getAttribute('aria-label')?.includes('next')
			)

		expect(navButtons.length).toBeGreaterThan(0)
		if (navButtons.length > 0) {
			await user.click(navButtons[0])
			// After clicking, calendar should still be rendered
			expect(screen.getAllByText(/Upcoming Events/i).length).toBeGreaterThan(0)
		}
	})
	it('should request events with onlyMine=true filter', async () => {
		render(<CalendarPage />, { wrapper })

		await waitFor(
			() => {
				// Check all calls to fetch
				const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
				const eventCall = fetchCalls.find((call) => call[0].includes('/api/events'))
				expect(eventCall).toBeDefined()
				expect(eventCall?.[0]).toContain('onlyMine=true')
			},
			{ timeout: 2000 }
		)
	})

	describe('Subscription Feed URL', () => {
		let user: ReturnType<typeof userEvent.setup>
		let writeTextMock: ReturnType<typeof vi.fn>

		beforeEach(async () => {
			user = userEvent.setup()
			writeTextMock = vi.fn().mockResolvedValue(undefined)

			Object.defineProperty(navigator, 'clipboard', {
				value: {
					writeText: writeTextMock,
				},
				writable: true,
				configurable: true,
			})

				; (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
					if (url.includes('/api/events')) {
						return Promise.resolve({
							ok: true,
							json: async () => ({ events: [] }),
						} as Response)
					}
					if (url.includes('/api/calendar/subscriptions')) {
						return Promise.resolve({
							ok: true,
							json: async () => ({ feedUrl: 'https://example.com/feed.ics' }),
						} as Response)
					}
					return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
				})

			render(<CalendarPage />, { wrapper })

			// Navigate to the "Ready to copy" state
			await waitFor(
				() => {
					expect(screen.getByText('Get Private Feed URL')).toBeInTheDocument()
				},
				{ timeout: 2000 }
			)
			await user.click(screen.getByText('Get Private Feed URL'))
			await user.click(screen.getByText('Generate Feed URL'))

			// Wait for Copy button to be ready
			await waitFor(() => {
				expect(screen.getByText('Copy')).toBeInTheDocument()
			})
		})

		it('should copy to clipboard successfully', async () => {
			await waitFor(() => {
				expect(screen.getByDisplayValue('https://example.com/feed.ics')).toBeInTheDocument()
			})

			await user.click(screen.getByText('Copy'))

			// Verify clipboard call and toast
			expect(writeTextMock).toHaveBeenCalledWith('https://example.com/feed.ics')
			await waitFor(() => {
				expect(mockAddToast).toHaveBeenCalledWith(
					expect.objectContaining({
						message: 'Copied!',
						variant: 'success',
					})
				)
			})
		})

		it('should show an error toast when clipboard API is not available', async () => {
			// Mock clipboard as unavailable
			Object.defineProperty(navigator, 'clipboard', {
				value: undefined,
				writable: true,
				configurable: true,
			})

			await user.click(screen.getByText('Copy'))

			// Verify error toast is shown
			await waitFor(() => {
				expect(mockAddToast).toHaveBeenCalledWith(
					expect.objectContaining({
						message: 'Failed to copy to clipboard',
						variant: 'error',
					})
				)
			})
		})
	})
})
