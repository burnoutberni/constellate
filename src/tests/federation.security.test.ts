
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js', async (importOriginal) => {
    const actual = await importOriginal<typeof activitypubHelpers>()
    return {
        ...actual,
        fetchActor: vi.fn(),
        // We don't mock cacheRemoteUser because we want to test its sanitization too!
        // But if it makes network calls, we might need to mock parts of it.
        // cacheRemoteUser calls trackInstance which is async, and prisma calls.
        // It seems fine to run it if we mock fetchActor.
    }
})
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Federation Security (XSS)', () => {
	let testEvent: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Create test event for comments
		testEvent = await prisma.event.create({
			data: {
				title: 'Security Test Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/security-test',
                attributedTo: 'https://example.com/users/local',
			},
		})

		vi.clearAllMocks()
	})

	it('should sanitize XSS in Create Note (Comment)', async () => {
		const remoteActor = {
			id: 'https://attacker.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
			inbox: 'https://attacker.com/users/evil/inbox',
            name: 'Evil User',
		}

        // Mock fetchActor to return the attacker
		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

        const xssContent = 'Hello <script>alert("XSS")</script> World'
        const safeContent = 'Hello  World' // Expectation after strict sanitization (strips tags)
        // Note: sanitizeText strips ALL tags, so <script>... content ...</script> -> content is NOT removed?
        // Wait, DOMPurify.sanitize('Hello <script>alert("XSS")</script> World') usually removes the script tag AND its content.
        // Let's verify what sanitizeText does.

		const activity = {
			id: 'https://attacker.com/activities/xss-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://attacker.com/comments/xss-1',
				content: xssContent,
				inReplyTo: testEvent.externalId,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(comment).toBeTruthy()
        // Currently (before fix), this fails if we expect it to be sanitized.
        // So we assert it IS sanitized to see it fail.
		expect(comment?.content).not.toContain('<script>')
	})

    it('should sanitize XSS in Create Event', async () => {
		const remoteActor = {
			id: 'https://attacker.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
            name: 'Evil User <img src=x onerror=alert(1)>', // XSS in name
		}

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

        const xssTitle = 'Event <script>alert(1)</script>'
        const xssSummary = 'Summary <img src=x onerror=alert(1)>'

		const activity = {
			id: 'https://attacker.com/activities/xss-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://attacker.com/events/xss-1',
				name: xssTitle,
				summary: xssSummary,
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		expect(event?.title).not.toContain('<script>')
        expect(event?.summary).not.toContain('<img')

        // Also check if the user name was sanitized when cached (via cacheRemoteUser)
        const user = await prisma.user.findUnique({
            where: { externalActorUrl: remoteActor.id }
        })
        expect(user?.name).not.toContain('<img')
    })
})
