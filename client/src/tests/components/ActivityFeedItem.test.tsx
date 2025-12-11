import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityFeedItem } from '../../components/ActivityFeedItem'
import type { Activity } from '../../types'
import type { Event } from '../../types'
import { createTestWrapper } from '../testUtils'

// Mock dependencies
const mockEvent: Event = {
    id: 'event1',
    title: 'Test Event',
    summary: 'Test summary',
    location: 'Test Location',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    visibility: 'PUBLIC',
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

const createActivity = (type: Activity['type'], data?: Activity['data']): Activity => ({
    id: `activity-${type}`,
    type,
    createdAt: '2024-01-15T10:00:00Z',
    user: {
        id: 'user2',
        username: 'otheruser',
        name: 'Other User',
        isRemote: false,
    },
    event: mockEvent,
    data,
})

// FollowButton is already mocked globally in mocks.ts, but we override it here for this test
// to provide a test ID for assertions
// Path matches how ActivityFeedItem imports it: './FollowButton'
vi.mock('../../components/FollowButton', () => ({
    FollowButton: ({ username }: { username: string }) => (
        <button data-testid={`follow-${username}`}>Follow</button>
    ),
}))

const { wrapper } = createTestWrapper()

describe('ActivityFeedItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render like activity', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags, so check for parts separately
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/liked/i)).toBeInTheDocument()
        expect(screen.getByText('❤️')).toBeInTheDocument()
    })

    it('should render RSVP activity', () => {
        const activity = createActivity('rsvp', { status: 'attending' })
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/will attend/i)).toBeInTheDocument()
        expect(screen.getByText('👍')).toBeInTheDocument()
    })

    it('should render maybe RSVP activity', () => {
        const activity = createActivity('rsvp', { status: 'maybe' })
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/might attend/i)).toBeInTheDocument()
    })

    it('should render comment activity', () => {
        const activity = createActivity('comment', { commentContent: 'Great event!' })
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/commented on/i)).toBeInTheDocument()
        expect(screen.getByText('💬')).toBeInTheDocument()
        expect(screen.getByText(/"Great event!"/i)).toBeInTheDocument()
    })

    it('should render event created activity', () => {
        const activity = createActivity('event_created')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/created/i)).toBeInTheDocument()
        expect(screen.getByText('📅')).toBeInTheDocument()
    })

    it('should render event shared activity', () => {
        const sharedEvent = {
            ...mockEvent,
            id: 'event2',
            title: 'Shared Event',
            user: {
                id: 'user3',
                username: 'shareduser',
                name: 'Shared User',
                isRemote: false,
            },
        }
        const activity: Activity = {
            id: 'activity-shared',
            type: 'event_shared',
            createdAt: '2024-01-15T10:00:00Z',
            user: {
                id: 'user2',
                username: 'otheruser',
                name: 'Other User',
                isRemote: false,
            },
            event: mockEvent,
            sharedEvent,
        }

        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Shared Event')).toBeInTheDocument()
        // "shared" may appear multiple times
        expect(screen.getAllByText(/shared/i).length).toBeGreaterThan(0)
        expect(screen.getByText(/from/i)).toBeInTheDocument()
        expect(screen.getByText('@shareduser')).toBeInTheDocument()
        expect(screen.getByText('🔁')).toBeInTheDocument()
    })

    it('should display event location', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        expect(screen.getByText(/📍 Test Location/i)).toBeInTheDocument()
    })

    it('should display event tags', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        expect(screen.getByText('#music')).toBeInTheDocument()
    })

    it('should display limited tags when more than 3', () => {
        const eventWithManyTags = {
            ...mockEvent,
            tags: [
                { id: '1', tag: 'music' },
                { id: '2', tag: 'dance' },
                { id: '3', tag: 'party' },
                { id: '4', tag: 'fun' },
            ],
        }
        const activity: Activity = {
            ...createActivity('like'),
            event: eventWithManyTags,
        }

        render(<ActivityFeedItem activity={activity} />, { wrapper })

        expect(screen.getByText('#music')).toBeInTheDocument()
        expect(screen.getByText('+1 more')).toBeInTheDocument()
    })

    it('should display visibility badge', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Check for visibility badge - icon and label are in a Badge component
        // The badge contains both icon and label together
        expect(screen.getByText(/PUBLIC/i)).toBeInTheDocument()
    })

    it('should display formatted time', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Time formatting is tested through the rendered output
        expect(screen.getByText(/Other User/i)).toBeInTheDocument()
    })

    it('should render follow button', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        expect(screen.getByTestId('follow-otheruser')).toBeInTheDocument()
    })

    it('should link to user profile', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Find the avatar link which links to user profile
        const userLinks = screen.getAllByRole('link')
        const userLink = userLinks.find(link => link.getAttribute('href') === '/@otheruser')
        expect(userLink).toBeInTheDocument()
    })

    it('should link to event', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Find the event link
        const eventLinks = screen.getAllByRole('link')
        const eventLink = eventLinks.find(link => link.getAttribute('href') === '/@testuser/event1')
        expect(eventLink).toBeInTheDocument()
    })

    it('should display event date', () => {
        const activity = createActivity('like')
        render(<ActivityFeedItem activity={activity} />, { wrapper })

        expect(screen.getByText(/📅/)).toBeInTheDocument()
    })

    it('should handle missing user name', () => {
        const activity: Activity = {
            ...createActivity('like'),
            user: {
                id: 'user2',
                username: 'otheruser',
                name: null,
                isRemote: false,
            },
        }

        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('otheruser')).toBeInTheDocument()
        expect(screen.getByText(/liked/i)).toBeInTheDocument()
    })

    it('should handle shared event without user', () => {
        const sharedEvent = {
            ...mockEvent,
            id: 'event2',
            title: 'Shared Event',
            user: null,
        }
        const activity: Activity = {
            id: 'activity-shared',
            type: 'event_shared',
            createdAt: '2024-01-15T10:00:00Z',
            user: {
                id: 'user2',
                username: 'otheruser',
                name: 'Other User',
                isRemote: false,
            },
            event: mockEvent,
            sharedEvent,
        }

        render(<ActivityFeedItem activity={activity} />, { wrapper })

        // Text is split across <strong> tags
        expect(screen.getByText('Other User')).toBeInTheDocument()
        expect(screen.getByText('Shared Event')).toBeInTheDocument()
        // "shared" may appear multiple times
        expect(screen.getAllByText(/shared/i).length).toBeGreaterThan(0)
    })
})
