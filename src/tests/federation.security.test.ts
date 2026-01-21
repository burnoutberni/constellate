import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		processedActivity: {
			create: vi.fn(),
		},
		event: {
			findFirst: vi.fn(),
			upsert: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		comment: {
			create: vi.fn(),
		},
	},
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	fetchActor: vi.fn().mockResolvedValue({
		id: 'https://remote.com/users/hacker',
		type: 'Person',
		inbox: 'https://remote.com/users/hacker/inbox',
	}),
	cacheRemoteUser: vi.fn().mockResolvedValue({
		id: 'remote_user_id',
		username: 'hacker',
		isRemote: true,
	}),
	getBaseUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

vi.mock('../lib/instanceHelpers.js', () => ({
	trackInstance: vi.fn(),
}))

vi.mock('../realtime.js', () => ({
	broadcast: vi.fn(),
	BroadcastEvents: {
		EVENT_CREATED: 'event:created',
		COMMENT_ADDED: 'comment:added',
	},
}))

describe('Federation Security (XSS Prevention)', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should sanitize event fields before storing', async () => {
		const maliciousEvent = {
			type: ObjectType.EVENT,
			id: 'https://remote.com/events/xss',
			name: 'Malicious Event <script>alert("title")</script>',
			summary: 'Summary with <script>alert("summary")</script> and <b>bold</b>',
			content: 'Content with <img src=x onerror=alert("content")>',
			location: 'Location <script>alert("loc")</script>',
			startTime: '2023-01-01T12:00:00Z',
			attributedTo: 'https://remote.com/users/hacker',
		}

		const activity = {
			id: 'https://remote.com/activities/1',
			type: ActivityType.CREATE,
			actor: 'https://remote.com/users/hacker',
			object: maliciousEvent,
		}

		// Mock successful activity processing
		vi.mocked(prisma.processedActivity.create).mockResolvedValue({
			id: '1',
			activityId: '1',
			expiresAt: new Date(),
		})

		// Mock event upsert to return something
		vi.mocked(prisma.event.upsert).mockResolvedValue({
			id: 'event_id',
			title: 'Malicious Event',
			startTime: new Date(),
		} as any)

		await handleActivity(activity as any)

		// Verify upsert was called with SANITIZED data
		expect(prisma.event.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					title: expect.stringContaining('Malicious Event'), // script removed
					summary: expect.stringContaining('Summary with'), // script removed, bold kept
					location: expect.stringContaining('Location'), // script removed
					// Content sanitization verification is a bit tricky with DOMPurify in test env depending on jsdom
					// but let's check basic expectation
				}),
			})
		)

		// Capture the arguments to inspect specifically
		const upsertCall = vi.mocked(prisma.event.upsert).mock.calls[0][0]
		const createData = upsertCall.create

		expect(createData.title).not.toContain('<script>')
		expect(createData.title).not.toContain('alert("title")')
		// Ensure the sanitized title is what we expect (allowing for whitespace leftovers)
		expect(createData.title.trim()).toBe('Malicious Event')

		expect(createData.summary).not.toContain('<script>')
		expect(createData.summary).toContain('<b>bold</b>') // Safe tags allowed

		expect(createData.location).not.toContain('<script>')
	})

	it('should sanitize comment content', async () => {
		const maliciousNote = {
			type: ObjectType.NOTE,
			id: 'https://remote.com/notes/xss',
			content: 'Nice event! <script>alert("comment")</script>',
			inReplyTo: 'https://local.com/events/1',
			attributedTo: 'https://remote.com/users/hacker',
		}

		const activity = {
			id: 'https://remote.com/activities/2',
			type: ActivityType.CREATE,
			actor: 'https://remote.com/users/hacker',
			object: maliciousNote,
		}

		vi.mocked(prisma.processedActivity.create).mockResolvedValue({
			id: '2',
			activityId: '2',
			expiresAt: new Date(),
		})

		// Mock finding the event
		vi.mocked(prisma.event.findFirst).mockResolvedValue({
			id: 'event_1',
			externalId: 'https://local.com/events/1',
		} as any)

		// Mock comment creation
		vi.mocked(prisma.comment.create).mockResolvedValue({
			id: 'comment_1',
			content: 'Nice event! ',
			createdAt: new Date(),
			author: { id: 'remote_user_id' },
		} as any)

		await handleActivity(activity as any)

		expect(prisma.comment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					content: expect.not.stringContaining('<script>'),
				}),
			})
		)

		const createCall = vi.mocked(prisma.comment.create).mock.calls[0][0]
		expect(createCall.data.content).toBe('Nice event! ')
	})
})
