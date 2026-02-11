import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'

vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Federation Security', () => {
	beforeEach(async () => {
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
		vi.clearAllMocks()
	})

	it('should NOT store javascript: URLs in event url field', async () => {
		const remoteActor = {
			id: 'https://example.com/users/attacker',
			type: 'Person',
			preferredUsername: 'attacker',
			inbox: 'https://example.com/users/attacker/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'attacker@example.com',
				email: 'attacker@example.com',
				name: 'Attacker',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-malicious-1',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/malicious-event-1',
				name: 'Malicious Event',
				startTime: new Date().toISOString(),
				url: 'javascript:alert(1)', // malicious URL
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		// Expectation: The URL should be null or sanitized, NOT javascript:alert(1)
		expect(event?.url).not.toBe('javascript:alert(1)')
	})
})
