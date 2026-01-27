/**
 * Security Tests for Federation Handlers
 * Verifies that incoming ActivityPub content is properly sanitized to prevent Stored XSS.
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
	let testUser: any

	beforeEach(async () => {
		// Clean up processed activities and data
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	describe('Event Sanitization', () => {
		it('should sanitize event fields on Create activity', async () => {
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

			const maliciousEvent = {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-1',
				name: 'Safe Title <script>alert(1)</script>',
				summary: '<b>Bold</b> <img src=x onerror=alert(1)>',
				content: '<p>Para</p> <iframe src="javascript:alert(1)"></iframe>',
				location: 'Safe Loc <script>alert(1)</script>',
				startTime: new Date().toISOString(),
			}

			const activity = {
				id: 'https://example.com/activities/create-xss-1',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: maliciousEvent,
			}

			await handleActivity(activity as any)

			const event = await prisma.event.findFirst({
				where: { externalId: maliciousEvent.id },
			})

			expect(event).toBeTruthy()
			// Title should be plain text (stripped completely)
			expect(event?.title).toBe('Safe Title ') // sanitizeText removes all tags
			// Summary should be safe HTML
			expect(event?.summary).toBe('<b>Bold</b> ') // img is NOT in ALLOWED_TAGS, so it is stripped.

			// Location should be plain text
			expect(event?.location).toBe('Safe Loc ')
		})

        it('should strip images and scripts but keep safe formatting', async () => {
			const remoteActor = {
				id: 'https://example.com/users/xss',
				type: 'Person',
			}
            const remoteUser = await prisma.user.create({
				data: {
					username: 'xss@example.com',
                    isRemote: true,
					externalActorUrl: remoteActor.id,
				},
			})

			vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
			vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

            const activity = {
				id: 'https://example.com/activities/create-xss-2',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
                    type: ObjectType.EVENT,
                    id: 'https://example.com/events/xss-2',
                    name: 'Test',
                    startTime: new Date().toISOString(),
                    // This contains allowed tags (b, i) and disallowed (script, img)
                    summary: '<b>Safe</b> <script>bad()</script> <i>Also Safe</i> <img src=x>',
                },
			}

            await handleActivity(activity as any)

            const event = await prisma.event.findFirst({
				where: { externalId: 'https://example.com/events/xss-2' },
			})

            // Expect strict sanitization based on ALLOWED_TAGS
            expect(event?.summary).toBe('<b>Safe</b>  <i>Also Safe</i> ')
        })
	})

	describe('Comment (Note) Sanitization', () => {
		it('should sanitize comment content on Create activity', async () => {
            const remoteActor = { id: 'https://example.com/users/troll', type: 'Person' }
            const remoteUser = await prisma.user.create({
				data: {
					username: 'troll@example.com',
                    isRemote: true,
					externalActorUrl: remoteActor.id,
				},
			})
            // Create event to comment on
            const event = await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/target',
                    attributedTo: 'https://example.com/users/victim',
                }
            })

			vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
			vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

			const activity = {
				id: 'https://example.com/activities/create-note-xss',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.NOTE,
					id: 'https://example.com/comments/xss',
					content: '<a href="javascript:alert(1)">Bad Link</a> <a href="https://good.com">Good Link</a>',
					inReplyTo: event.externalId,
				},
			}

			await handleActivity(activity as any)

			const comment = await prisma.comment.findFirst({
				where: { externalId: activity.object.id },
			})

			expect(comment).toBeTruthy()
            // javascript: href should be stripped or the link removed
            // DOMPurify with ALLOWED_URI_REGEXP should strip the href or the tag if it fails validation
            // The default config I copied strips javascript: URIs.
			expect(comment?.content).not.toContain('javascript:alert')
            expect(comment?.content).toContain('Bad Link') // The text remains
            expect(comment?.content).toContain('href="https://good.com"')
		})
	})

    describe('Profile Update Sanitization', () => {
        it('should sanitize user profile fields on Update activity', async () => {
            const remoteUser = await prisma.user.create({
				data: {
					username: 'updater@example.com',
                    isRemote: true,
					externalActorUrl: 'https://example.com/users/updater',
                    name: 'Old Name',
                    bio: 'Old Bio',
				},
			})

            const activity = {
				id: 'https://example.com/activities/update-profile-xss',
				type: ActivityType.UPDATE,
				actor: remoteUser.externalActorUrl,
				object: {
					type: ObjectType.PERSON,
					id: remoteUser.externalActorUrl,
                    name: 'New <b>Name</b>', // Should be plain text
                    summary: 'New <b>Bio</b> <script>alert(1)</script>', // Should be safe HTML
				},
			}

            await handleActivity(activity as any)

            const updatedUser = await prisma.user.findUnique({
                where: { id: remoteUser.id }
            })

            expect(updatedUser?.name).toBe('New Name') // sanitizeText strips <b>
            expect(updatedUser?.bio).toBe('New <b>Bio</b> ') // sanitizeHtml keeps <b>, removes script
        })
    })
})
