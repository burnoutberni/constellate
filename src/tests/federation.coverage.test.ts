import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'
import * as instanceHelpers from '../lib/instanceHelpers.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')
vi.mock('../lib/instanceHelpers.js')

describe('Federation Coverage Tests', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
		vi.clearAllMocks()
	})

	it('should handle Create activity with empty optional fields (coverage)', async () => {
		const remoteActor = {
			id: 'https://example.com/users/coverage',
			type: 'Person',
			preferredUsername: 'coverage',
			inbox: 'https://example.com/users/coverage/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'coverage@example.com',
				email: 'coverage@example.com',
				name: 'Coverage',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-minimal',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/minimal',
				name: 'Minimal Event',
				startTime: new Date().toISOString(),
				// Missing summary, location, eventStatus, eventAttendanceMode
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		expect(event?.title).toBe('Minimal Event')
		expect(event?.summary).toBeNull()
		expect(event?.location).toBeNull()
		expect(event?.eventStatus).toBeNull()
		expect(event?.eventAttendanceMode).toBeNull()
	})

	it('should handle Create activity with all fields (coverage)', async () => {
		const remoteActor = {
			id: 'https://example.com/users/coverage',
			type: 'Person',
			preferredUsername: 'coverage',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'coverage@example.com',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

		const activity = {
			id: 'https://example.com/activities/create-full',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/full',
				name: 'Full Event',
				summary: 'Summary with <b>HTML</b>',
				location: { name: 'Location Name' },
				eventStatus: 'EventScheduled',
				eventAttendanceMode: 'OfflineEventAttendanceMode',
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		expect(event?.title).toBe('Full Event')
		expect(event?.summary).toBe('Summary with <b>HTML</b>')
		expect(event?.location).toBe('Location Name')
		expect(event?.eventStatus).toBe('EventScheduled')
		expect(event?.eventAttendanceMode).toBe('OfflineEventAttendanceMode')
	})

	it('should handle Update activity with empty optional fields (coverage)', async () => {
		const remoteActor = {
			id: 'https://example.com/users/coverage',
			type: 'Person',
			preferredUsername: 'coverage',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'coverage@example.com',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		// Create existing event with values
		await prisma.event.create({
			data: {
				title: 'Original Title',
				summary: 'Original Summary',
				location: 'Original Location',
				eventStatus: 'EventScheduled',
				startTime: new Date(),
				externalId: 'https://example.com/events/update-coverage',
				attributedTo: remoteActor.id,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

		// Update to clear fields
		const activity = {
			id: 'https://example.com/activities/update-clear',
			type: ActivityType.UPDATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/update-coverage',
				name: 'Updated Title',
				startTime: new Date().toISOString(),
				// Missing summary, location, status implies clearing them in handleUpdateEvent logic
				// Note: extractEventProperties returns null for missing fields
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event?.title).toBe('Updated Title')
		expect(event?.summary).toBeNull() // Cleared
		expect(event?.location).toBeNull() // Cleared
		expect(event?.eventStatus).toBeNull() // Cleared
	})

	it('should handle Update Person with empty optional fields (coverage)', async () => {
		const remoteActor = {
			id: 'https://example.com/users/coverage-person',
			type: 'Person',
			preferredUsername: 'coverage-person',
		}

		await prisma.user.create({
			data: {
				username: 'coverage-person@example.com',
				name: 'Original Name',
				bio: 'Original Bio',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)

		// Update with minimal fields (no name/bio)
		const activity = {
			id: 'https://example.com/activities/update-person-minimal',
			type: ActivityType.UPDATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.PERSON,
				id: remoteActor.id,
				preferredUsername: 'coverage-person',
				// Missing name and summary (bio)
			},
		}

		await handleActivity(activity as any)

		const user = await prisma.user.findFirst({
			where: { externalActorUrl: remoteActor.id },
		})

		// Should NOT clear existing values if they are undefined in the update
		// handleUpdatePerson uses: name: personName ? ... : undefined
		// undefined means "do not update" in Prisma
		expect(user?.name).toBe('Original Name')
		expect(user?.bio).toBe('Original Bio')
	})

	it('should handle Update Person with cleared fields (explicit null/empty) (coverage)', async () => {
		// ActivityPub doesn't strictly define "clearing" via null in JSON-LD always,
		// but our implementation checks for truthiness.
		// If we want to clear, we might need to change implementation or just test the truthy path.
		// Wait, `handleUpdatePerson`:
		// const personName = personObj.name || undefined
		// If personObj.name is "", personName becomes undefined.
		// So we can't clear name with "".
		// This test just confirms the branch coverage for the "truthy" path.

		const remoteActor = {
			id: 'https://example.com/users/coverage-person-full',
			type: 'Person',
			preferredUsername: 'coverage-person-full',
		}

		await prisma.user.create({
			data: {
				username: 'coverage-person-full@example.com',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		const activity = {
			id: 'https://example.com/activities/update-person-full',
			type: ActivityType.UPDATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.PERSON,
				id: remoteActor.id,
				preferredUsername: 'coverage-person-full',
				name: 'New Name',
				summary: 'New Bio',
			},
		}

		await handleActivity(activity as any)

		const user = await prisma.user.findFirst({
			where: { externalActorUrl: remoteActor.id },
		})

		expect(user?.name).toBe('New Name')
		expect(user?.bio).toBe('New Bio')
	})
})
