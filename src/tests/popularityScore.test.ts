import { describe, it, expect, beforeEach } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import { updateEventPopularityScore } from '../services/popularityUpdater.js'

describe('Popularity Score Integration Tests', () => {
	let testUser: any
	const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

	beforeEach(async () => {
		await prisma.eventTag.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		const timestamp = Date.now()
		const randomSuffix = Math.random().toString(36).substring(7)
		const suffix = `${timestamp}_${randomSuffix}`

		testUser = await prisma.user.create({
			data: {
				username: `testuser_${suffix}`,
				email: `testuser_${suffix}@test.com`,
				name: 'Test User',
				isRemote: false,
			},
		})
	})

	describe('Real-time popularity score updates', () => {
		it('should update popularity score when attendance is added', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			// Add attendance
			await prisma.eventAttendance.create({
				data: {
					eventId: event.id,
					userId: testUser.id,
					status: 'attending',
				},
			})

			// Update popularity score
			await updateEventPopularityScore(event.id)

			// Verify score was updated: 1 attendance * 2 = 2
			const updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(2)
		})

		it('should update popularity score when like is added', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			// Add like
			await prisma.eventLike.create({
				data: {
					eventId: event.id,
					userId: testUser.id,
				},
			})

			// Update popularity score
			await updateEventPopularityScore(event.id)

			// Verify score was updated: 1 like = 1
			const updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(1)
		})

		it('should calculate popularity score correctly (attendance * 2 + likes)', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			// Create additional users
			const user2 = await prisma.user.create({
				data: {
					username: `user2_${Date.now()}`,
					email: `user2_${Date.now()}@test.com`,
					name: 'User 2',
					isRemote: false,
				},
			})

			const user3 = await prisma.user.create({
				data: {
					username: `user3_${Date.now()}`,
					email: `user3_${Date.now()}@test.com`,
					name: 'User 3',
					isRemote: false,
				},
			})

			// Add 3 attendance
			await prisma.eventAttendance.createMany({
				data: [
					{ eventId: event.id, userId: testUser.id, status: 'attending' },
					{ eventId: event.id, userId: user2.id, status: 'attending' },
					{ eventId: event.id, userId: user3.id, status: 'attending' },
				],
			})

			// Add 2 likes
			await prisma.eventLike.createMany({
				data: [
					{ eventId: event.id, userId: testUser.id },
					{ eventId: event.id, userId: user2.id },
				],
			})

			// Update popularity score
			await updateEventPopularityScore(event.id)

			// Verify score: 3 attendance * 2 + 2 likes = 8
			const updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(8)
		})

		it('should update popularity score when attendance is removed', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			// Add attendance
			await prisma.eventAttendance.create({
				data: {
					eventId: event.id,
					userId: testUser.id,
					status: 'attending',
				},
			})

			// Update score
			await updateEventPopularityScore(event.id)
			let updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(2)

			// Remove attendance
			await prisma.eventAttendance.delete({
				where: {
					eventId_userId: {
						eventId: event.id,
						userId: testUser.id,
					},
				},
			})

			// Update score again
			await updateEventPopularityScore(event.id)
			updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(0)
		})

		it('should update popularity score when like is removed', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			// Add like
			await prisma.eventLike.create({
				data: {
					eventId: event.id,
					userId: testUser.id,
				},
			})

			// Update score
			await updateEventPopularityScore(event.id)
			let updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(1)

			// Remove like
			await prisma.eventLike.delete({
				where: {
					eventId_userId: {
						eventId: event.id,
						userId: testUser.id,
					},
				},
			})

			// Update score again
			await updateEventPopularityScore(event.id)
			updatedEvent = await prisma.event.findUnique({
				where: { id: event.id },
			})
			expect(updatedEvent?.popularityScore).toBe(0)
		})
	})

	describe('Search with popularity score', () => {
		it('should return events sorted by popularityScore in search results', async () => {
			// Create events with different popularity scores
			const event1 = await prisma.event.create({
				data: {
					title: 'Low Popularity',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 2,
				},
			})

			const event2 = await prisma.event.create({
				data: {
					title: 'High Popularity',
					startTime: new Date(Date.now() + 172800000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 10,
				},
			})

			const event3 = await prisma.event.create({
				data: {
					title: 'Medium Popularity',
					startTime: new Date(Date.now() + 259200000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 5,
				},
			})

			const res = await app.request('/api/search?sort=popularity')
			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.events).toBeDefined()
			expect(body.events.length).toBeGreaterThanOrEqual(3)

			const eventIds = body.events.map((e: { id: string }) => e.id)
			const event1Index = eventIds.indexOf(event1.id)
			const event2Index = eventIds.indexOf(event2.id)
			const event3Index = eventIds.indexOf(event3.id)

			// Event 2 (score 10) should come first
			expect(event2Index).toBeLessThan(event3Index)
			expect(event2Index).toBeLessThan(event1Index)
			// Event 3 (score 5) should come before Event 1 (score 2)
			expect(event3Index).toBeLessThan(event1Index)
		})

		it('should return events sorted by popularityScore in /popular endpoint', async () => {
			const event1 = await prisma.event.create({
				data: {
					title: 'Less Popular',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 1,
				},
			})

			const event2 = await prisma.event.create({
				data: {
					title: 'More Popular',
					startTime: new Date(Date.now() + 172800000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 10,
				},
			})

			const res = await app.request('/api/search/popular')
			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.events).toBeDefined()

			const eventIds = body.events.map((e: { id: string }) => e.id)
			const event1Index = eventIds.indexOf(event1.id)
			const event2Index = eventIds.indexOf(event2.id)

			// Event 2 (score 10) should come before Event 1 (score 1)
			expect(event2Index).toBeLessThan(event1Index)
		})
	})

	describe('Edge cases', () => {
		it('should handle events with zero popularity score', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'No Engagement',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 0,
				},
			})

			const res = await app.request('/api/search?sort=popularity')
			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const foundEvent = body.events.find((e: { id: string }) => e.id === event.id)
			expect(foundEvent).toBeDefined()
		})

		it('should handle very high popularity scores', async () => {
			const event = await prisma.event.create({
				data: {
					title: 'Very Popular',
					startTime: new Date(Date.now() + 86400000),
					userId: testUser.id,
					attributedTo: `${baseUrl}/users/${testUser.username}`,
					popularityScore: 1000,
				},
			})

			const res = await app.request('/api/search?sort=popularity')
			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const eventIds = body.events.map((e: { id: string }) => e.id)
			// Very popular event should be near the top
			expect(eventIds.indexOf(event.id)).toBeGreaterThanOrEqual(0)
		})
	})
})
