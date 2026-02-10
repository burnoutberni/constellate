
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Federation Security Handlers', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
        vi.clearAllMocks()
	})

	it('should sanitize XSS payload in event content', async () => {
		const remoteActor = {
			id: 'https://attacker.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
			inbox: 'https://attacker.com/users/evil/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'evil@attacker.com',
				email: 'evil@attacker.com',
				name: 'Evil User',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>'
        const maliciousTitle = 'Malicious Event <script>alert(1)</script>'

		const activity = {
			id: 'https://attacker.com/activities/create-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://attacker.com/events/xss-event',
				name: maliciousTitle,
				content: `Safe content ${xssPayload}`,
                summary: `Safe summary ${xssPayload}`,
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		// Verify event was created
		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()

        // Assert sanitization
		expect(event?.title).toBe('Malicious Event ') // Script stripped from title (sanitizeText)
        expect(event?.title).not.toContain('<script>')

		expect(event?.summary).toContain('Safe summary')
        expect(event?.summary).not.toContain('<script>') // Script stripped from summary (sanitizeHtml)
        expect(event?.summary).not.toContain('onerror')

        // Note: content maps to summary if summary is missing, but here both are present.
        // Wait, logic is: summary: eventSummary || eventContent || null
        // So summary should take precedence.

        // Let's test content fallback too
	})

    it('should preserve safe HTML in event content', async () => {
		const remoteActor = {
			id: 'https://friend.com/users/nice',
			type: 'Person',
			preferredUsername: 'nice',
			inbox: 'https://friend.com/users/nice/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'nice@friend.com',
				email: 'nice@friend.com',
				name: 'Nice User',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const safeHtml = '<b>Bold</b> <i>Italic</i> <a href="https://example.com">Link</a>'

		const activity = {
			id: 'https://friend.com/activities/create-safe',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://friend.com/events/safe-event',
				name: 'Safe Event',
				summary: safeHtml,
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
		expect(event?.summary).toContain('<b>Bold</b>')
        expect(event?.summary).toContain('<i>Italic</i>')
        expect(event?.summary).toContain('<a href="https://example.com">Link</a>')
	})
})
