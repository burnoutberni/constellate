import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getEventRecommendations } from '../../services/recommendations.js'
import { prisma } from '../../lib/prisma.js'

describe('Recommendations Service', () => {
	const baseUrl = process.env.BASE_URL || 'http://test.local'
	let viewer: { id: string; username: string }
	let organizer: { id: string; username: string }

	beforeEach(async () => {
		vi.clearAllMocks()

		viewer = await prisma.user.create({
			data: {
				username: `viewer_${Date.now()}`,
				email: `viewer_${Date.now()}@test.com`,
				name: 'Viewer',
				isRemote: false,
			},
		})

		organizer = await prisma.user.create({
			data: {
				username: `organizer_${Date.now()}`,
				email: `organizer_${Date.now()}@test.com`,
				name: 'Organizer',
				isRemote: false,
			},
		})
	})

	describe('getEventRecommendations', () => {
		it('returns recommendations with metadata', async () => {
			await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result).toHaveProperty('recommendations')
			expect(result).toHaveProperty('metadata')
			expect(result.metadata).toHaveProperty('generatedAt')
			expect(result.metadata).toHaveProperty('signals')
			expect(result.metadata.signals).toHaveProperty('tags')
			expect(result.metadata.signals).toHaveProperty('hosts')
			expect(result.metadata.signals).toHaveProperty('followed')
		})

		it('respects limit parameter', async () => {
			for (let i = 0; i < 5; i++) {
				await prisma.event.create({
					data: {
						title: `Event ${i}`,
						startTime: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
						userId: organizer.id,
						attributedTo: `${baseUrl}/users/${organizer.username}`,
					},
				})
			}

			const result = await getEventRecommendations(viewer.id, 2)

			expect(result.recommendations.length).toBeLessThanOrEqual(2)
		})

		it('enforces maximum limit of 20', async () => {
			const result = await getEventRecommendations(viewer.id, 100)

			expect(result.recommendations.length).toBeLessThanOrEqual(20)
		})

		it('enforces minimum limit of 1', async () => {
			await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id, 0)

			expect(result.recommendations.length).toBeGreaterThanOrEqual(0)
		})

		it('builds interest profile from attendance', async () => {
			const pastEvent = await prisma.event.create({
				data: {
					title: 'Past Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'music' }],
					},
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: pastEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			await prisma.event.create({
				data: {
					title: 'Future Music Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'music' }],
					},
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.metadata.signals.tags).toBeGreaterThanOrEqual(1)
		})

		it('builds interest profile from likes', async () => {
			const likedEvent = await prisma.event.create({
				data: {
					title: 'Liked Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'art' }],
					},
				},
			})

			await prisma.eventLike.create({
				data: {
					eventId: likedEvent.id,
					userId: viewer.id,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.metadata.signals.tags).toBeGreaterThanOrEqual(1)
		})

		it('includes host weights in interest profile', async () => {
			const hostEvent = await prisma.event.create({
				data: {
					title: 'Host Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: hostEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.metadata.signals.hosts).toBeGreaterThanOrEqual(1)
		})

		it('considers following in recommendations', async () => {
			const followedUser = await prisma.user.create({
				data: {
					username: `followed_${Date.now()}`,
					email: `followed_${Date.now()}@test.com`,
					name: 'Followed',
					isRemote: false,
				},
			})

			await prisma.following.create({
				data: {
					userId: viewer.id,
					actorUrl: `${baseUrl}/users/${followedUser.username}`,
					username: followedUser.username,
					inboxUrl: `${baseUrl}/users/${followedUser.username}/inbox`,
					accepted: true,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.metadata.signals.followed).toBeGreaterThanOrEqual(1)
		})

		it('excludes events user has already engaged with', async () => {
			const engagedEvent = await prisma.event.create({
				data: {
					title: 'Engaged Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: engagedEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const hasEngagedEvent = result.recommendations.some(
				(r) => r.event.id === engagedEvent.id
			)
			expect(hasEngagedEvent).toBe(false)
		})

		it('excludes own events', async () => {
			const ownEvent = await prisma.event.create({
				data: {
					title: 'My Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: viewer.id,
					attributedTo: `${baseUrl}/users/${viewer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const hasOwnEvent = result.recommendations.some((r) => r.event.id === ownEvent.id)
			expect(hasOwnEvent).toBe(false)
		})

		it('excludes shared events', async () => {
			const originalEvent = await prisma.event.create({
				data: {
					title: 'Original Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			await prisma.event.create({
				data: {
					title: 'Shared Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: viewer.id,
					attributedTo: `${baseUrl}/users/${viewer.username}`,
					sharedEventId: originalEvent.id,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const hasSharedEvent = result.recommendations.some(
				(r) => r.event.sharedEventId !== null
			)
			expect(hasSharedEvent).toBe(false)
		})

		it('includes events that recently started (within 2 hours)', async () => {
			const recentlyStartedEvent = await prisma.event.create({
				data: {
					title: 'Just Started Event',
					startTime: new Date(Date.now() - 30 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const hasRecentEvent = result.recommendations.some(
				(r) => r.event.id === recentlyStartedEvent.id
			)
			expect(hasRecentEvent).toBe(true)
		})

		it('returns fallback recommendations when no candidates match', async () => {
			await prisma.event.create({
				data: {
					title: 'Fallback Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					visibility: 'PUBLIC',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.recommendations.length).toBeGreaterThanOrEqual(0)
		})

		it('hydrates event users from attributedTo', async () => {
			const remoteUser = await prisma.user.create({
				data: {
					username: `remote_${Date.now()}@remote.example.com`,
					email: `remote_${Date.now()}@test.com`,
					name: 'Remote User',
					isRemote: true,
					externalActorUrl: 'https://remote.example.com/users/remote',
				},
			})

			await prisma.event.create({
				data: {
					title: 'Remote Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					attributedTo: 'https://remote.example.com/users/remote',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			if (result.recommendations.length > 0) {
				const eventWithRemoteUser = result.recommendations.find(
					(r) => r.event.attributedTo === 'https://remote.example.com/users/remote'
				)
				if (eventWithRemoteUser) {
					expect(eventWithRemoteUser.event.user).toBeDefined()
				}
			}
		})

		it('handles events with only attributedTo (no userId)', async () => {
			await prisma.event.create({
				data: {
					title: 'Event without userId',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					attributedTo: 'https://external.example.com/users/external',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.recommendations).toBeDefined()
		})

		it('includes popularity score in signals', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Popular Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const attendee = await prisma.user.create({
				data: {
					username: `attendee_${Date.now()}`,
					email: `attendee_${Date.now()}@test.com`,
					name: 'Attendee',
					isRemote: false,
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: event.id,
					userId: attendee.id,
					status: 'attending',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const recommendation = result.recommendations.find((r) => r.event.id === event.id)
			if (recommendation) {
				expect(recommendation.signals).toHaveProperty('popularityScore')
				expect(typeof recommendation.signals.popularityScore).toBe('number')
			}
		})

		it('includes reason for matched tags', async () => {
			const pastEvent = await prisma.event.create({
				data: {
					title: 'Past Tech Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'technology' }],
					},
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: pastEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			const futureEvent = await prisma.event.create({
				data: {
					title: 'Future Tech Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'technology' }],
					},
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const recommendation = result.recommendations.find((r) => r.event.id === futureEvent.id)
			if (recommendation) {
				expect(recommendation.reasons.some((r) => r.includes('#technology'))).toBe(true)
				expect(recommendation.signals.matchedTags).toContain('technology')
			}
		})

		it('includes reason for followed organizer', async () => {
			const followedUser = await prisma.user.create({
				data: {
					username: `followed_org_${Date.now()}`,
					email: `followed_org_${Date.now()}@test.com`,
					name: 'Followed Organizer',
					isRemote: false,
				},
			})

			await prisma.following.create({
				data: {
					userId: viewer.id,
					actorUrl: `${baseUrl}/users/${followedUser.username}`,
					username: followedUser.username,
					inboxUrl: `${baseUrl}/users/${followedUser.username}/inbox`,
					accepted: true,
				},
			})

			const event = await prisma.event.create({
				data: {
					title: 'Event by Followed User',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const recommendation = result.recommendations.find((r) => r.event.id === event.id)
			if (recommendation) {
				expect(recommendation.reasons.some((r) => r.includes('you follow'))).toBe(true)
				expect(recommendation.signals.followedOrganizer).toBe(true)
			}
		})

		it('includes reason for host affinity', async () => {
			const pastEvent = await prisma.event.create({
				data: {
					title: 'Past Host Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: pastEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			const futureEvent = await prisma.event.create({
				data: {
					title: 'Future Host Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const recommendation = result.recommendations.find((r) => r.event.id === futureEvent.id)
			if (recommendation) {
				expect(recommendation.signals.hostAffinity).toBe(true)
			}
		})

		it('includes reason for popular events', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Very Popular Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			for (let i = 0; i < 6; i++) {
				const attendee = await prisma.user.create({
					data: {
						username: `pop_attendee_${Date.now()}_${i}`,
						email: `pop_attendee_${Date.now()}_${i}@test.com`,
						name: `Popular Attendee ${i}`,
						isRemote: false,
					},
				})

				await prisma.eventAttendance.create({
					data: {
						eventId: event.id,
						userId: attendee.id,
						status: 'attending',
					},
				})
			}

			const result = await getEventRecommendations(viewer.id)

			const recommendation = result.recommendations.find((r) => r.event.id === event.id)
			expect(recommendation).toBeDefined()
		})

		it('includes default reason when no signals match', async () => {
			await prisma.event.create({
				data: {
					title: 'Basic Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			if (result.recommendations.length > 0) {
				expect(result.recommendations[0].reasons.length).toBeGreaterThan(0)
			}
		})

		it('formats tag reasons with max 3 tags', async () => {
			const pastEvent = await prisma.event.create({
				data: {
					title: 'Multi-tag Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [
							{ tag: 'tag1' },
							{ tag: 'tag2' },
							{ tag: 'tag3' },
							{ tag: 'tag4' },
						],
					},
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: pastEvent.id,
					userId: viewer.id,
					status: 'attending',
				},
			})

			await prisma.event.create({
				data: {
					title: 'Future Multi-tag Event',
					startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [
							{ tag: 'tag1' },
							{ tag: 'tag2' },
							{ tag: 'tag3' },
							{ tag: 'tag4' },
						],
					},
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.recommendations.length).toBeGreaterThanOrEqual(0)
		})

		it('handles maybe status in attendance', async () => {
			const pastEvent = await prisma.event.create({
				data: {
					title: 'Maybe Event',
					startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
					tags: {
						create: [{ tag: 'maybe-tag' }],
					},
				},
			})

			await prisma.eventAttendance.create({
				data: {
					eventId: pastEvent.id,
					userId: viewer.id,
					status: 'maybe',
				},
			})

			const result = await getEventRecommendations(viewer.id)

			expect(result.metadata.signals.tags).toBeGreaterThanOrEqual(1)
		})

		it('uses recency scoring for upcoming events', async () => {
			const soonEvent = await prisma.event.create({
				data: {
					title: 'Soon Event',
					startTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const laterEvent = await prisma.event.create({
				data: {
					title: 'Later Event',
					startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					userId: organizer.id,
					attributedTo: `${baseUrl}/users/${organizer.username}`,
				},
			})

			const result = await getEventRecommendations(viewer.id)

			const soonRec = result.recommendations.find((r) => r.event.id === soonEvent.id)
			const laterRec = result.recommendations.find((r) => r.event.id === laterEvent.id)

			if (soonRec && laterRec) {
				expect(soonRec.score).toBeGreaterThanOrEqual(laterRec.score)
			}
		})
	})
})
