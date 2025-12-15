import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditEventPage } from '../../pages/EditEventPage'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockEvent: Event = {
	id: 'event1',
	title: 'Test Event',
	summary: 'Test summary',
	location: 'Test Location',
	locationLatitude: 40.7128,
	locationLongitude: -74.006,
	url: 'https://example.com',
	startTime: '2024-01-15T10:00:00Z',
	endTime: '2024-01-15T12:00:00Z',
	timezone: 'UTC',
	visibility: 'PUBLIC',
	recurrencePattern: '',
	recurrenceEndDate: null,
	tags: [{ id: '1', tag: 'music' }],
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

const mockUseEventDetail = vi.fn()
const mockUseUpdateEvent = vi.fn()
const mockUseLocationSuggestions = vi.fn()
const mockNavigate = vi.fn(() => {}) // Stable function reference
const mockAddToast = vi.fn(() => {}) // Stable function reference

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

vi.mock('../../hooks/queries/events', () => ({
	useEventDetail: (username: string, eventId: string) => {
		// Return loading state if parameters are empty (initial render)
		if (!username || !eventId) {
			return {
				data: undefined,
				isLoading: true,
				error: null,
			}
		}
		return mockUseEventDetail()
	},
	useUpdateEvent: (eventId: string, username: string) => {
		// Return a default mutation if parameters are empty
		if (!eventId || !username) {
			return {
				mutateAsync: vi.fn().mockResolvedValue({}),
				isPending: false,
			}
		}
		return mockUseUpdateEvent()
	},
}))

vi.mock('../../hooks/useLocationSuggestions', () => ({
	useLocationSuggestions: () => mockUseLocationSuggestions(),
	MIN_QUERY_LENGTH: 3,
}))

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom')
	return {
		...actual,
		useNavigate: () => mockNavigate,
		useLocation: () => ({
			pathname: '/edit/@testuser/event1',
			search: '',
			hash: '',
			state: null,
			key: 'default',
		}),
	}
})

// Create a stable mock state object
const mockUIStoreState = {
	addToast: mockAddToast,
}

// Type for selector function - parameter name required by TypeScript but unused
// eslint-disable-next-line no-unused-vars
type SelectorFn = (state: unknown) => unknown

vi.mock('../../stores', () => ({
	useUIStore: (selector?: SelectorFn) => {
		return selector ? selector(mockUIStoreState) : mockUIStoreState
	},
}))

// Mock Navbar to prevent API calls
vi.mock('../../components/Navbar', () => ({
	Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}))

global.fetch = vi.fn()

// Mock crypto.randomUUID if not available
if (!global.crypto) {
	global.crypto = {
		randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substring(2, 15),
	} as unknown as Crypto
}

const { wrapper, queryClient } = createTestWrapper(['/edit/@testuser/event1'])

// Create stable mock return values
const stableEventData = {
	...mockEvent,
	startTime: mockEvent.startTime || '2024-01-15T10:00:00Z',
	endTime: mockEvent.endTime || '2024-01-15T12:00:00Z',
}

const stableEventDetailReturn = {
	data: stableEventData,
	isLoading: false,
	error: null,
}

const stableMutateAsync = vi.fn().mockResolvedValue({})
const stableUpdateEventReturn = {
	mutateAsync: stableMutateAsync,
	isPending: false,
}

const stableLocationSuggestionsReturn = {
	suggestions: [],
	loading: false,
	error: null,
}

describe('EditEventPage', () => {
	beforeEach(() => {
		// Aggressively clear QueryClient cache before each test to prevent memory accumulation
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		// Reset the stable mutateAsync mock
		stableMutateAsync.mockResolvedValue({})
		// Use stable references to prevent re-renders
		mockUseEventDetail.mockReturnValue(stableEventDetailReturn)
		mockUseUpdateEvent.mockReturnValue(stableUpdateEventReturn)
		mockUseLocationSuggestions.mockReturnValue(stableLocationSuggestionsReturn)
	})

	afterEach(() => {
		// Aggressively clear QueryClient cache after each test
		clearQueryClient(queryClient)
	})

	it('should render loading state', () => {
		mockUseEventDetail.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		})

		render(<EditEventPage />, { wrapper })
		expect(screen.getByText('Loading event...')).toBeInTheDocument()
	})

	it('should render edit form with event data', async () => {
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument()
				expect(screen.getByDisplayValue('Test summary')).toBeInTheDocument()
				expect(screen.getByDisplayValue('Test Location')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should redirect if user is not owner', async () => {
		const otherUserEvent = {
			...mockEvent,
			user: { ...mockEvent.user, id: 'user2' },
			startTime: mockEvent.startTime || '2024-01-15T10:00:00Z',
			endTime: mockEvent.endTime || '2024-01-15T12:00:00Z',
			tags: mockEvent.tags || [],
		}
		mockUseEventDetail.mockReturnValue({
			data: otherUserEvent,
			isLoading: false,
		})

		render(<EditEventPage />, { wrapper })

		// Check that user is redirected (user-visible behavior - they can't access the edit page)
		// Also check that error toast was shown with correct variant
		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith('/@testuser/event1', { replace: true })
				expect(mockAddToast).toHaveBeenCalledWith(
					expect.objectContaining({ variant: 'error' })
				)
			},
			{ timeout: 2000 }
		)
	})

	it('should update form fields', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const titleInput = screen.getByDisplayValue('Test Event')
		await user.clear(titleInput)
		await user.type(titleInput, 'Updated Event Title')

		expect(titleInput).toHaveValue('Updated Event Title')
	})

	it('should add tags', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByPlaceholderText('Add a tag')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const tagInput = screen.getByPlaceholderText('Add a tag')
		const addButton = screen.getByRole('button', { name: 'Add' })

		await user.type(tagInput, 'newtag')
		await user.click(addButton)

		await waitFor(
			() => {
				expect(screen.getByText('#newtag')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should remove tags', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByText('#music')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const removeButton = screen.getByText('×')
		await user.click(removeButton)

		await waitFor(
			() => {
				expect(screen.queryByText('#music')).not.toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should validate and submit form', async () => {
		const user = userEvent.setup()
		const mockMutateAsync = vi.fn().mockResolvedValue({})
		mockUseUpdateEvent.mockReturnValue({
			mutateAsync: mockMutateAsync,
			isPending: false,
		})

		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const submitButton = screen.getByRole('button', { name: 'Save Changes' })
		await user.click(submitButton)

		await waitFor(
			() => {
				expect(mockMutateAsync).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})

	it('should show error for empty title', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByDisplayValue('Test Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const titleInput = screen.getByDisplayValue('Test Event')
		await user.clear(titleInput)

		const submitButton = screen.getByRole('button', { name: 'Save Changes' })
		await user.click(submitButton)

		// HTML5 validation should prevent submission, but if it doesn't, check for error
		await waitFor(
			() => {
				// The form should not submit if title is empty (HTML5 validation)
				expect(titleInput).toBeInvalid()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle location suggestions', async () => {
		const user = userEvent.setup()
		const suggestions = [{ label: 'New York, NY', latitude: 40.7128, longitude: -74.006 }]
		mockUseLocationSuggestions.mockReturnValue({
			suggestions,
			loading: false,
			error: null,
		})

		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				const locationInput = screen.getByPlaceholderText('Enter location')
				expect(locationInput).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const locationInput = screen.getByPlaceholderText('Enter location')
		await user.type(locationInput, 'New York')

		await waitFor(
			() => {
				expect(screen.getByText('New York, NY')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const suggestionButton = screen.getByText('New York, NY')
		await user.click(suggestionButton)

		await waitFor(
			() => {
				expect(locationInput).toHaveValue('New York, NY')
			},
			{ timeout: 2000 }
		)
	})

	it('should handle recurrence pattern selection', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Find the select by finding the label text, then the select that follows
		const recurrenceLabel = screen.getByText('Recurrence')
		const recurrenceSelect = recurrenceLabel.parentElement?.querySelector(
			'select'
		) as HTMLSelectElement
		expect(recurrenceSelect).toBeInTheDocument()

		await user.selectOptions(recurrenceSelect, 'WEEKLY')

		// After selecting WEEKLY, the "Repeat Until" field should appear
		await waitFor(
			() => {
				const repeatUntilLabel = screen.getByText('Repeat Until')
				expect(repeatUntilLabel).toBeInTheDocument()
				const repeatUntilInput =
					repeatUntilLabel.parentElement?.querySelector('input[type="date"]')
				expect(repeatUntilInput).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle visibility selection', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Find the select by finding the label text, then the select that follows
		const visibilityLabel = screen.getByText('Visibility')
		const visibilitySelect = visibilityLabel.parentElement?.querySelector(
			'select'
		) as HTMLSelectElement
		expect(visibilitySelect).toBeInTheDocument()

		await user.selectOptions(visibilitySelect, 'UNLISTED')
		expect(visibilitySelect).toHaveValue('UNLISTED')
	})

	it('should cancel and navigate back', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const cancelButton = screen.getByRole('button', { name: 'Cancel' })
		await user.click(cancelButton)

		expect(mockNavigate).toHaveBeenCalledWith('/@testuser/event1')
	})

	it('should handle geolocation', async () => {
		const user = userEvent.setup()
		const mockGeolocation = {
			getCurrentPosition: vi.fn((success) => {
				// Call success immediately
				setTimeout(() => {
					success({
						coords: {
							latitude: 40.7128,
							longitude: -74.006,
						},
					})
				}, 0)
			}),
		}
		Object.defineProperty(global.navigator, 'geolocation', {
			value: mockGeolocation,
			writable: true,
			configurable: true,
		})

		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(
					screen.getByRole('button', { name: 'Use Current Location' })
				).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const geoButton = screen.getByRole('button', { name: 'Use Current Location' })
		await user.click(geoButton)

		await waitFor(
			() => {
				expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle geolocation error', async () => {
		const user = userEvent.setup()
		const mockGeolocation = {
			getCurrentPosition: vi.fn((_success, error) => {
				// Call error immediately
				setTimeout(() => {
					error(new Error('Geolocation error'))
				}, 0)
			}),
		}
		Object.defineProperty(global.navigator, 'geolocation', {
			value: mockGeolocation,
			writable: true,
			configurable: true,
		})

		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(
					screen.getByRole('button', { name: 'Use Current Location' })
				).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const geoButton = screen.getByRole('button', { name: 'Use Current Location' })
		await user.click(geoButton)

		await waitFor(
			() => {
				expect(mockAddToast).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})

	it('should clear coordinates', async () => {
		const user = userEvent.setup()
		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByDisplayValue('40.7128')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const clearButton = screen.getByRole('button', { name: 'Clear Coordinates' })
		await user.click(clearButton)

		// Coordinates should be cleared - check that the input is now empty
		await waitFor(
			() => {
				// Find the Latitude label, then the input that follows
				const latLabel = screen.getByText('Latitude')
				const latInput = latLabel.parentElement?.querySelector(
					'input[type="text"]'
				) as HTMLInputElement
				expect(latInput).toBeInTheDocument()
				expect(latInput).toHaveValue('')
			},
			{ timeout: 2000 }
		)
	})

	it('should handle submission error', async () => {
		const user = userEvent.setup()
		const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Update failed'))
		mockUseUpdateEvent.mockReturnValue({
			mutateAsync: mockMutateAsync,
			isPending: false,
		})

		render(<EditEventPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Edit Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		await waitFor(
			() => {
				expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const submitButton = screen.getByRole('button', { name: 'Save Changes' })
		await user.click(submitButton)

		await waitFor(
			() => {
				expect(mockAddToast).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})
})
