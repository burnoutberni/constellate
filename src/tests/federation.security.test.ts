
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

describe('Federation Security (Stored XSS)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	it('should sanitize event titles from remote instances', async () => {
		const remoteActor = {
			id: 'https://example.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
			inbox: 'https://example.com/users/evil/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'evil@example.com',
				email: 'evil@example.com',
				name: 'Evil',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-xss-1',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event-1',
				name: '<script>alert("XSS")</script>Test Event',
				summary: '<img src=x onerror=alert(1)>',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
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
		// This expectation will FAIL currently because we don't sanitize
		expect(event?.title).toBe('Test Event')
		expect(event?.summary).toBe('')
	})
})
