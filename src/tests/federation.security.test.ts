import { describe, it, expect, vi } from 'vitest'
import { extractEventProperties } from '../federation.js'

// Mock dependencies to avoid side effects and DB connections
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		event: { findFirst: vi.fn(), upsert: vi.fn() },
		user: { findUnique: vi.fn(), updateMany: vi.fn() },
	},
}))

vi.mock('../realtime.js', () => ({
	broadcast: vi.fn(),
	broadcastToUser: vi.fn(),
	BroadcastEvents: {},
}))

vi.mock('../services/ActivityDelivery.js', () => ({
	deliverToInbox: vi.fn(),
}))

vi.mock('../services/ActivityBuilder.js', () => ({
	buildAcceptActivity: vi.fn(),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	cacheRemoteUser: vi.fn(),
	fetchActor: vi.fn(),
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
	fetchRemoteCollectionCount: vi.fn(),
}))

vi.mock('../lib/ssrfProtection.js', () => ({
	safeFetch: vi.fn(),
}))

vi.mock('../lib/instanceHelpers.js', () => ({
	trackInstance: vi.fn(),
}))

describe('Federation Security', () => {
	it('should sanitize XSS from event summary and content', () => {
		const maliciousEvent = {
			id: 'https://example.com/events/1',
			type: 'Event',
			name: 'Safe Title',
			summary: 'Safe summary <script>alert("XSS")</script>',
			content: '<p>Content</p><img src=x onerror=alert(1)>',
			location: 'Park',
			startTime: '2023-01-01T10:00:00Z',
		}

		const props = extractEventProperties(maliciousEvent)

		// Check for XSS removal
		expect(props.eventSummary).not.toContain('<script>')
		expect(props.eventSummary).toContain('Safe summary')

		expect(props.eventContent).not.toContain('onerror')
		expect(props.eventContent).not.toContain('<img') // img is not in ALLOWED_TAGS
		expect(props.eventContent).toContain('<p>Content</p>') // Safe tags preserved
	})

	it('should strip all HTML from event name and location', () => {
		const maliciousEvent = {
			id: 'https://example.com/events/2',
			name: '<b>Bold Title</b>',
			location: '<a href="http://evil.com">Evil Park</a>',
			startTime: '2023-01-01T10:00:00Z',
		}

		const props = extractEventProperties(maliciousEvent)

		// Name should be plain text
		expect(props.eventName).toBe('Bold Title')
		expect(props.eventName).not.toContain('<b>')

		// Location should be plain text
		expect(props.locationValue).toBe('Evil Park')
		expect(props.locationValue).not.toContain('<a')
	})
})
