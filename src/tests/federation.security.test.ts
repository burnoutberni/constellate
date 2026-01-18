/**
 * Security Tests for Federation Handlers
 * Verifies that incoming ActivityPub content is properly sanitized to prevent XSS.
 */

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

describe('Federation Security (XSS Prevention)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up processed activities
		await prisma.processedActivity.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	it('should sanitize HTML in Create Event activity', async () => {
		const remoteActor = {
			id: 'https://example.com/users/hacker',
			type: 'Person',
			preferredUsername: 'hacker',
			inbox: 'https://example.com/users/hacker/inbox',
		}

		// Create the remote user in the database first
		const remoteUser = await prisma.user.create({
			data: {
				username: 'hacker@example.com',
				email: 'hacker@example.com',
				name: 'Hacker',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const maliciousSummary = 'Safe <script>alert("XSS")</script> <b>Bold</b>'
		const maliciousContent = '<p>Content</p><img src=x onerror=alert(1)>'
		const maliciousLocation = 'Central Park <iframe src="javascript:alert(1)"></iframe>'

		const activity = {
			id: 'https://example.com/activities/create-exploit-1',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/exploit-event-1',
				name: 'Exploit Event',
				summary: maliciousSummary,
				content: maliciousContent,
				location: maliciousLocation,
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
			},
		}

		await handleActivity(activity as any)

		// Verify event was created and content sanitized
		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		// Expect scripts to be removed but safe HTML to remain (or at least stripped if sanitizeText is used,
		// but our goal is sanitizeHtml which preserves safe tags)

		// Assuming we want to allow <b> and <p> but remove <script>, <img> (with onerror), and <iframe>
		expect(event?.summary).not.toContain('<script>')
		expect(event?.summary).toContain('<b>Bold</b>') // Should verify we allow some HTML

		expect(event?.summary).not.toContain('<img src=x onerror=alert(1)>') // Content is often mapped to summary in DB if summary is missing, but here we have both.
		// Wait, DB schema has 'summary' (which can be HTML).
		// Let's check how extractEventProperties maps them.
		// It maps eventSummary -> summary, or eventContent -> summary if eventSummary is missing.

		// In this test case, we provided both. The extractEventProperties returns both.
		// The DB upsert uses: summary: eventSummary || eventContent || null,

		// So we only check event.summary in DB.

		expect(event?.summary).not.toContain('<script>')
		expect(event?.summary).toContain('Safe')

		expect(event?.location).not.toContain('<iframe')
		expect(event?.location).toContain('Central Park')
	})

	it('should sanitize HTML in Update Event activity', async () => {
		const remoteEvent = await prisma.event.create({
			data: {
				title: 'Safe Event',
				summary: 'Safe summary',
				location: 'Safe location',
				startTime: new Date(),
				externalId: 'https://example.com/events/exploit-event-2',
				attributedTo: 'https://example.com/users/hacker',
			},
		})

		const maliciousSummary = 'Updated <script>alert("XSS")</script>'

		const activity = {
			id: 'https://example.com/activities/update-exploit-1',
			type: ActivityType.UPDATE,
			actor: 'https://example.com/users/hacker',
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/exploit-event-2',
				name: 'Updated Exploit Event',
				summary: maliciousSummary,
			},
		}

		await handleActivity(activity as any)

		const updatedEvent = await prisma.event.findUnique({
			where: { id: remoteEvent.id },
		})

		expect(updatedEvent).toBeDefined()
		expect(updatedEvent?.summary).not.toContain('<script>')
		expect(updatedEvent?.summary).toContain('Updated')
	})
})
