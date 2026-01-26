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

		// Reset mocks
		vi.clearAllMocks()
	})

	describe('XSS Prevention', () => {
		it('should sanitize Event summary and content', async () => {
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

			const maliciousContent = '<script>alert("XSS")</script><p>Safe content</p>'
			const maliciousSummary = '<img src=x onerror=alert(1)>Safe summary'

			const activity = {
				id: 'https://example.com/activities/create-xss-event',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.EVENT,
					id: 'https://example.com/events/xss-event',
					name: 'XSS Event <script>',
					summary: maliciousSummary,
					content: maliciousContent,
					location: {
						type: 'Place',
						name: 'Hacker HQ <script>',
					},
					startTime: new Date().toISOString(),
				},
			}

			await handleActivity(activity as any)

			const event = await prisma.event.findFirst({
				where: {
					externalId: 'https://example.com/events/xss-event',
				},
			})

			expect(event).toBeTruthy()
			// Should strip script tags but keep safe HTML for summary/content
			expect(event?.summary).not.toContain('<script>')
			expect(event?.summary).not.toContain('onerror')
			expect(event?.title).not.toContain('<script>')
			expect(event?.location).not.toContain('<script>')

			// If sanitization is working, these should be cleaned
			// Currently, without the fix, these assertions might fail or pass depending on current implementation
			// We expect them to fail initially if no sanitization is present
		})

		it('should sanitize Note (Comment) content', async () => {
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

			const testEvent = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(),
					attributedTo: 'https://example.com/users/alice',
					externalId: 'https://example.com/events/1',
				},
			})

			vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
			vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

			const maliciousContent = '<a href="javascript:alert(1)">Click me</a>'

			const activity = {
				id: 'https://example.com/activities/create-xss-note',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.NOTE,
					id: 'https://example.com/comments/xss-note',
					content: maliciousContent,
					inReplyTo: testEvent.externalId,
				},
			}

			await handleActivity(activity as any)

			const comment = await prisma.comment.findFirst({
				where: {
					externalId: 'https://example.com/comments/xss-note',
				},
			})

			expect(comment).toBeTruthy()
			expect(comment?.content).not.toContain('javascript:')
		})

		it('should sanitize Person (Profile) updates', async () => {
			const remoteUser = await prisma.user.create({
				data: {
					username: 'hacker@example.com',
					isRemote: true,
					externalActorUrl: 'https://example.com/users/hacker-profile',
					name: 'Original Name',
					bio: 'Original bio',
				},
			})

			const activity = {
				id: 'https://example.com/activities/update-profile-xss',
				type: ActivityType.UPDATE,
				actor: 'https://example.com/users/hacker-profile',
				object: {
					type: ObjectType.PERSON,
					id: 'https://example.com/users/hacker-profile',
					name: 'Hacker <script>alert(1)</script>',
					summary: 'Bio with <iframe src="evil.com"></iframe>',
				},
			}

			await handleActivity(activity as any)

			const updatedUser = await prisma.user.findUnique({
				where: { id: remoteUser.id },
			})

			expect(updatedUser?.name).not.toContain('<script>')
			expect(updatedUser?.bio).not.toContain('<iframe')
		})
	})
})
