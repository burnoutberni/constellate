/**
 * Security Tests for Federation Handlers
 * Verifies XSS sanitization and other security controls
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

describe('Federation Security', () => {
	let testUser: any
	let testEvent: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up processed activities
		await prisma.processedActivity.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.follower.deleteMany({})
		await prisma.following.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Create test user
		testUser = await prisma.user.create({
			data: {
				username: 'alice',
				email: 'alice@test.com',
				name: 'Alice Test',
				isRemote: false,
			},
		})

		// Create test event
		testEvent = await prisma.event.create({
			data: {
				title: 'Test Event',
				startTime: new Date(),
				userId: testUser.id,
				attributedTo: `${baseUrl}/users/${testUser.username}`,
			},
		})

		// Reset mocks
		vi.clearAllMocks()
	})

	describe('XSS Prevention', () => {
		it('should sanitize event content in Create activity', async () => {
			const remoteActor = {
				id: 'https://example.com/users/hacker',
				type: 'Person',
				preferredUsername: 'hacker',
				inbox: 'https://example.com/users/hacker/inbox',
			}

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

			const maliciousContent = 'Nice event <script>alert("XSS")</script>'
			const maliciousSummary = '<b>Bold</b> <img src=x onerror=alert(1)>'
            const sanitizedContent = 'Nice event ' // sanitizeText strips all tags
            const sanitizedSummary = 'Bold '

			const activity = {
				id: 'https://example.com/activities/create-malicious-event',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.EVENT,
					id: 'https://example.com/events/malicious-1',
					name: 'Malicious Event',
					summary: maliciousSummary,
					content: maliciousContent,
					startTime: new Date().toISOString(),
				},
			}

			await handleActivity(activity as any)

			// Verify event was created and sanitized
			const event = await prisma.event.findFirst({
				where: {
					externalId: activity.object.id,
				},
			})

			expect(event).toBeTruthy()
			expect(event?.summary).toBe(sanitizedSummary)
            // Note: event schema might map content to summary or something else, let's check mapping.
            // In federation.ts: summary: eventSummary || eventContent || null
            // Since we provided both, summary is used.
		})

		it('should sanitize comment content in Create activity', async () => {
			const remoteActor = {
				id: 'https://example.com/users/hacker',
				type: 'Person',
				preferredUsername: 'hacker',
				inbox: 'https://example.com/users/hacker/inbox',
			}

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

			const maliciousContent = 'Nice post <script>alert("XSS")</script>'
            const sanitizedContent = 'Nice post '

			const activity = {
				id: 'https://example.com/activities/create-malicious-comment',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.NOTE,
					id: 'https://example.com/comments/malicious-1',
					content: maliciousContent,
					inReplyTo: `${baseUrl}/events/${testEvent.id}`,
				},
			}

			await handleActivity(activity as any)

			const comment = await prisma.comment.findFirst({
				where: {
					externalId: activity.object.id,
				},
			})

			expect(comment).toBeTruthy()
			expect(comment?.content).toBe(sanitizedContent)
		})

		it('should sanitize user profile in Update activity', async () => {
			const remoteUser = await prisma.user.create({
				data: {
					username: 'hacker@example.com',
					email: 'hacker@example.com',
					name: 'Original Name',
					isRemote: true,
					externalActorUrl: 'https://example.com/users/hacker-profile',
				},
			})

            const maliciousBio = 'I am <script>alert("hacker")</script>'
            const sanitizedBio = 'I am '
            const maliciousName = 'Hacker <h1>Name</h1>'
            const sanitizedName = 'Hacker Name'

			const activity = {
				id: 'https://example.com/activities/update-malicious-profile',
				type: ActivityType.UPDATE,
				actor: 'https://example.com/users/hacker-profile',
				object: {
					type: ObjectType.PERSON,
					id: 'https://example.com/users/hacker-profile',
					preferredUsername: 'hacker',
					name: maliciousName,
					summary: maliciousBio,
				},
			}

			await handleActivity(activity as any)

			const updatedUser = await prisma.user.findUnique({
				where: { id: remoteUser.id },
			})

			expect(updatedUser?.bio).toBe(sanitizedBio)
            expect(updatedUser?.name).toBe(sanitizedName)
		})
	})
})
