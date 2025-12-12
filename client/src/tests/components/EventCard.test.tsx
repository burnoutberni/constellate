import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EventCard } from '../../components/EventCard'
import type { Event } from '../../types'

// Mock useAuth hook
const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

// Mock date formatting functions to ensure consistent test results across timezones
vi.mock('../../lib/formatUtils', () => ({
	formatTime: vi.fn((dateString: string) => {
		// Return consistent time format for '2024-01-15T10:00:00Z'
		if (dateString === '2024-01-15T10:00:00Z') {
			return '11:00 AM'
		}
		// Fallback to actual implementation for other dates
		const date = new Date(dateString)
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
		})
	}),
	formatRelativeDate: vi.fn((dateString: string) => {
		// Return consistent date format for '2024-01-15T10:00:00Z'
		if (dateString === '2024-01-15T10:00:00Z') {
			return 'Jan 15, 2024'
		}
		// Fallback to actual implementation for other dates
		const date = new Date(dateString)
		const now = new Date()
		const dateStart = new Date(
			Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
		)
		const nowStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
		)
		const days = Math.floor((dateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24))

		if (days === 0) return 'Today'
		if (days === 1) return 'Tomorrow'
		if (days > 1 && days < 7) return `In ${days} days`

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.getUTCFullYear() !== now.getUTCFullYear() ? 'numeric' : undefined,
		})
	}),
}))

const createMockEvent = (overrides?: Partial<Event>): Event => ({
	id: '1',
	title: 'Test Event',
	summary: 'This is a test event summary',
	location: 'Test Location',
	startTime: '2024-01-15T10:00:00Z',
	endTime: '2024-01-15T12:00:00Z',
	timezone: 'UTC',
	visibility: 'PUBLIC',
	tags: [
		{ id: '1', tag: 'test' },
		{ id: '2', tag: 'event' },
	],
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
	...overrides,
})

const renderEventCard = (props: Parameters<typeof EventCard>[0]) => {
	return render(
		<BrowserRouter>
			<EventCard {...props} />
		</BrowserRouter>
	)
}

describe('EventCard Component', () => {
	beforeEach(() => {
		mockUseAuth.mockReturnValue({
			user: null,
			loading: false,
			login: vi.fn(),
			sendMagicLink: vi.fn(),
			signup: vi.fn(),
			logout: vi.fn(),
		})
	})

	describe('Full Variant', () => {
		it('user can see complete event information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.getByText('This is a test event summary')).toBeInTheDocument()
			expect(screen.getByText(/Test Location/)).toBeInTheDocument()
		})

		it('user can navigate to event by clicking card', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const link = screen.getByRole('link', { name: /Test Event/ })
			expect(link).toHaveAttribute('href', '/@testuser/1')
		})

		it('user can see event header image when available', () => {
			const event = createMockEvent({
				headerImage: 'https://example.com/image.jpg',
			})
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const image = screen.getByAltText('Test Event')
			expect(image).toBeInTheDocument()
			expect(image).toHaveAttribute('src', 'https://example.com/image.jpg')
		})

		it('user can see event tags with overflow indicator', () => {
			const event = createMockEvent({
				tags: [
					{ id: '1', tag: 'tag1' },
					{ id: '2', tag: 'tag2' },
					{ id: '3', tag: 'tag3' },
					{ id: '4', tag: 'tag4' },
					{ id: '5', tag: 'tag5' },
				],
			})
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('tag1')).toBeInTheDocument()
			expect(screen.getByText('tag2')).toBeInTheDocument()
			expect(screen.getByText('tag3')).toBeInTheDocument()
			expect(screen.getByText('+2')).toBeInTheDocument()
		})

		it('user can see engagement stats', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('10')).toBeInTheDocument() // attendance
			expect(screen.getByText('5')).toBeInTheDocument() // likes
			expect(screen.getByText('3')).toBeInTheDocument() // comments
		})

		it('user can see organizer information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			// Check for username which is unique
			expect(screen.getByText('@testuser')).toBeInTheDocument()
			// Check that organizer name appears (may appear multiple times in avatar and text)
			expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
		})

		it('user sees sign up link when not authenticated', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const signUpLink = screen.getByText('Sign up to RSVP')
			expect(signUpLink).toBeInTheDocument()
			expect(signUpLink.closest('a')).toHaveAttribute('href', '/login')
		})

		it('user does not see sign up link when authenticated', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: true })

			expect(screen.queryByText('Sign up to RSVP')).not.toBeInTheDocument()
		})

		it('renders gracefully when optional fields are missing', () => {
			const event = createMockEvent({
				summary: undefined,
				location: undefined,
				headerImage: undefined,
				tags: [],
				_count: undefined,
				user: undefined,
			})
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByText('This is a test event summary')).not.toBeInTheDocument()
		})

		it('user can see date and time information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			// Date formatting is handled by formatRelativeDate and formatTime
			// We verify the formatted date text is present (user-facing)
			expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
			expect(screen.getByText(/11:00 AM/)).toBeInTheDocument()
		})

		it('defaults to full variant when variant not specified', () => {
			const event = createMockEvent()
			renderEventCard({ event, isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			// Full variant shows summary
			expect(screen.getByText('This is a test event summary')).toBeInTheDocument()
		})
	})

	describe('Compact Variant', () => {
		it('user can see essential event information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.getByText(/Test Location/)).toBeInTheDocument()
		})

		it('user can navigate to event by clicking card', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			const link = screen.getByRole('link', { name: /Test Event/ })
			expect(link).toHaveAttribute('href', '/@testuser/1')
		})

		it('user can see attendance count badge when available', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.getByText('10 attending')).toBeInTheDocument()
		})

		it('user can see organizer information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.getByText('@testuser')).toBeInTheDocument()
		})

		it('user can see date and time information', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			// Verify the formatted date text is present (user-facing)
			expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
			expect(screen.getByText(/11:00 AM/)).toBeInTheDocument()
		})

		it('does not show summary in compact variant', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.queryByText('This is a test event summary')).not.toBeInTheDocument()
		})

		it('renders gracefully when optional fields are missing', () => {
			const event = createMockEvent({
				location: undefined,
				_count: undefined,
				user: undefined,
			})
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
		})

		it('does not show attendance badge when count is zero', () => {
			const event = createMockEvent({
				_count: {
					attendance: 0,
					likes: 0,
					comments: 0,
				},
			})
			renderEventCard({ event, variant: 'compact', isAuthenticated: false })

			expect(screen.queryByText('0 attending')).not.toBeInTheDocument()
		})
	})

	describe('Navigation and Links', () => {
		it('generates correct event path with username', () => {
			const event = createMockEvent()
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const link = screen.getByRole('link', { name: /Test Event/ })
			expect(link).toHaveAttribute('href', '/@testuser/1')
		})

		it('generates correct event path without username', () => {
			const event = createMockEvent({ user: undefined })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const link = screen.getByRole('link', { name: /Test Event/ })
			expect(link).toHaveAttribute('href', '/events/1')
		})

		it('uses originalEventId when available', () => {
			const event = createMockEvent({ originalEventId: 'original-123' })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			const link = screen.getByRole('link', { name: /Test Event/ })
			expect(link).toHaveAttribute('href', '/@testuser/original-123')
		})
	})

	describe('Edge Cases', () => {
		it('handles events with no tags gracefully', () => {
			const event = createMockEvent({ tags: [] })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByText('#test')).not.toBeInTheDocument()
		})

		it('handles events with many tags', () => {
			const event = createMockEvent({
				tags: Array.from({ length: 10 }, (_, i) => ({
					id: `tag-${i}`,
					tag: `tag${i}`,
				})),
			})
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			// Should show first 3 tags and "+7 more"
			expect(screen.getByText('tag0')).toBeInTheDocument()
			expect(screen.getByText('tag1')).toBeInTheDocument()
			expect(screen.getByText('tag2')).toBeInTheDocument()
			expect(screen.getByText('+7')).toBeInTheDocument()
		})

		it('handles events without engagement stats', () => {
			const event = createMockEvent({ _count: undefined })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByText('10')).not.toBeInTheDocument()
		})

		it('handles events with zero engagement stats', () => {
			const event = createMockEvent({
				_count: {
					attendance: 0,
					likes: 0,
					comments: 0,
				},
			})
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			// Zero counts should not be displayed
			expect(screen.queryByText('0')).not.toBeInTheDocument()
		})

		it('handles events without location', () => {
			const event = createMockEvent({ location: undefined })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByLabelText('Location')).not.toBeInTheDocument()
		})

		it('handles events without summary', () => {
			const event = createMockEvent({ summary: undefined })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByText('This is a test event summary')).not.toBeInTheDocument()
		})

		it('handles events without header image', () => {
			const event = createMockEvent({ headerImage: undefined })
			renderEventCard({ event, variant: 'full', isAuthenticated: false })

			expect(screen.getByText('Test Event')).toBeInTheDocument()
			expect(screen.queryByAltText('Test Event')).not.toBeInTheDocument()
		})
	})
})
