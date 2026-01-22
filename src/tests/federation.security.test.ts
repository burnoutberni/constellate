/**
 * Security Tests for Federation Handlers
 * Verifies protection against XSS and other vulnerabilities
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
		// Clean up processed activities and data
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	describe('XSS Prevention', () => {
		it('should sanitize stored XSS in event fields', async () => {
			const remoteActor = {
				id: 'https://evil.com/users/attacker',
				type: 'Person',
				preferredUsername: 'attacker',
				inbox: 'https://evil.com/users/attacker/inbox',
			}

			// Create the remote user in the database first
			const remoteUser = await prisma.user.create({
				data: {
					username: 'attacker@evil.com',
					email: 'attacker@evil.com',
					name: 'Attacker',
					isRemote: true,
					externalActorUrl: remoteActor.id,
					inboxUrl: remoteActor.inbox,
				},
			})

			vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
			vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
			vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

			const maliciousName = 'Event <script>alert("xss")</script>'
			const maliciousSummary = 'Summary with <img src=x onerror=alert(1)>'

			const activity = {
				id: 'https://evil.com/activities/create-malicious-1',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.EVENT,
					id: 'https://evil.com/events/malicious-1',
					name: maliciousName,
					summary: maliciousSummary,
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

			// Verify name sanitization (sanitizeText strips everything)
			expect(event?.title).not.toContain('<script>')
			expect(event?.title).toBe('Event ')

			// Verify summary sanitization (sanitizeHtml strips dangerous tags/attributes)
			expect(event?.summary).not.toContain('onerror')
			expect(event?.summary).not.toContain('<img')
			expect(event?.summary).toBe('Summary with ')
		})

		it('should sanitize content when summary is missing', async () => {
			const remoteActor = {
				id: 'https://evil.com/users/attacker',
				type: 'Person',
				preferredUsername: 'attacker',
				inbox: 'https://evil.com/users/attacker/inbox',
			}

			// Create the remote user in the database first
			const remoteUser = await prisma.user.create({
				data: {
					username: 'attacker@evil.com',
					email: 'attacker@evil.com',
					name: 'Attacker',
					isRemote: true,
					externalActorUrl: remoteActor.id,
					inboxUrl: remoteActor.inbox,
				},
			})

			vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
			vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
			vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

			const maliciousContent = 'Content with <a href="javascript:alert(1)">click me</a> and <b>bold</b>'

			const activity = {
				id: 'https://evil.com/activities/create-malicious-2',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.EVENT,
					id: 'https://evil.com/events/malicious-2',
					name: 'Clean Title',
					// No summary, so content is used
					content: maliciousContent,
					startTime: new Date().toISOString(),
					endTime: new Date(Date.now() + 3600000).toISOString(),
				},
			}

			await handleActivity(activity as any)

			const event = await prisma.event.findFirst({
				where: {
					externalId: activity.object.id,
				},
			})

			expect(event).toBeTruthy()

			// javascript: href should be stripped, <a> might remain if attributes are safe or just stripped if empty?
			// DOMPurify with ALLOWED_URI_REGEXP prevents javascript:
			// Usually invalid href makes it just <a>click me</a> or strips the attribute.
			expect(event?.summary).not.toContain('javascript:')
			expect(event?.summary).toContain('click me')
			expect(event?.summary).toContain('<b>bold</b>') // Safe tag allowed
		})
	})
})
