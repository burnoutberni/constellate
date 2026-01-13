import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
	normalizeRecipients,
	buildAddressingFromActivity,
	getBroadcastTarget,
	transformEventsForClient,
	hydrateEventUsers,
} from '../events.js'
import { prisma } from '../lib/prisma.js'

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
	},
}))

describe('events helper utilities', () => {
	describe('normalizeRecipients', () => {
		it('returns empty array when value is undefined', () => {
			expect(normalizeRecipients()).toEqual([])
		})

		it('wraps single string values into an array', () => {
			expect(normalizeRecipients('https://example.com')).toEqual(['https://example.com'])
		})

		it('returns the same array instance when already an array', () => {
			const recipients = ['https://example.com/a', 'https://example.com/b']
			expect(normalizeRecipients(recipients)).toBe(recipients)
		})
	})

	describe('buildAddressingFromActivity', () => {
		it('normalizes string recipients into arrays', () => {
			const addressing = buildAddressingFromActivity({
				to: 'https://example.com/to',
				cc: 'https://example.com/cc',
			})

			expect(addressing).toEqual({
				to: ['https://example.com/to'],
				cc: ['https://example.com/cc'],
				bcc: [],
			})
		})

		it('handles missing to/cc fields gracefully', () => {
			const addressing = buildAddressingFromActivity({})
			expect(addressing).toEqual({ to: [], cc: [], bcc: [] })
		})

		it('preserves existing arrays without cloning', () => {
			const to = ['https://example.com/a']
			const cc = ['https://example.com/b']
			const addressing = buildAddressingFromActivity({ to, cc })

			expect(addressing.to).toBe(to)
			expect(addressing.cc).toBe(cc)
		})
	})

	describe('getBroadcastTarget', () => {
		it('returns undefined for public events', () => {
			expect(getBroadcastTarget('PUBLIC', 'owner')).toBeUndefined()
		})

		it('returns undefined for follower-only events to broadcast widely', () => {
			expect(getBroadcastTarget('FOLLOWERS', 'owner')).toBeUndefined()
		})

		it('returns owner id for private and unlisted events', () => {
			expect(getBroadcastTarget('PRIVATE', 'owner')).toBe('owner')
			expect(getBroadcastTarget('UNLISTED', 'owner')).toBe('owner')
		})

		it('defaults to public when visibility is missing', () => {
			expect(getBroadcastTarget(undefined, 'owner')).toBeUndefined()
		})
	})

	describe('transformEventsForClient', () => {
		it('ensures _count is populated when missing', () => {
			const events = [{ id: '1' }] as any
			const result = transformEventsForClient(events)
			expect(result[0]._count).toEqual({ attendance: 0, likes: 0, comments: 0 })
		})

		it('preserves existing _count', () => {
			const events = [{ id: '1', _count: { attendance: 5, likes: 2, comments: 1 } }] as any
			const result = transformEventsForClient(events)
			expect(result[0]._count).toEqual({ attendance: 5, likes: 2, comments: 1 })
		})

		it('derives viewerStatus from attendance', () => {
			const events = [
				{
					id: '1',
					attendance: [{ userId: 'user1', status: 'attending' }],
				},
			] as any
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBe('attending')
		})

		it('returns null viewerStatus if user not in attendance', () => {
			const events = [
				{
					id: '1',
					attendance: [{ userId: 'user2', status: 'attending' }],
				},
			] as any
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBeNull()
		})

		it('preserves existing viewerStatus if present', () => {
			const events = [
				{
					id: '1',
					viewerStatus: 'maybe',
					attendance: [{ userId: 'user1', status: 'attending' }],
				},
			] as any
			// Even if attendance says 'attending', if 'viewerStatus' is already set, it should keep it
			// (Assuming the function prefers existing prop as per implementation: (event ...).viewerStatus ?? derived)
			const result = transformEventsForClient(events, 'user1')
			expect(result[0].viewerStatus).toBe('maybe')
		})
	})

	describe('hydrateEventUsers', () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it('returns events unchanged when no external URLs to resolve', async () => {
			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
				},
			] as any

			const result = await hydrateEventUsers(events)

			expect(result).toEqual(events)
			expect(prisma.user.findMany).not.toHaveBeenCalled()
		})

		it('hydrates user from attributedTo when user is missing', async () => {
			const mockUser = {
				id: 'user_123',
				username: 'bob@example.com',
				name: 'Bob',
				displayColor: '#3b82f6',
				profileImage: null,
				isRemote: true,
				externalActorUrl: 'https://example.com/users/bob',
			}

			const events = [
				{
					id: '1',
					user: null,
					attributedTo: 'https://example.com/users/bob',
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue([mockUser] as any)

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).user).toEqual(mockUser)
			expect(prisma.user.findMany).toHaveBeenCalledWith({
				where: { externalActorUrl: { in: ['https://example.com/users/bob'] } },
				select: expect.any(Object),
			})
		})

		it('does not modify events when user already exists', async () => {
			const existingUser = { id: 'user1', username: 'alice' }
			const events = [
				{
					id: '1',
					user: existingUser,
					attributedTo: 'https://example.com/users/bob',
				},
			] as any

			const result = await hydrateEventUsers(events)

			expect(result).toEqual(events)
			expect((result[0] as any).user).toBe(existingUser)
		})

		it('hydrates organizers with user data', async () => {
			const mockOrganizer = {
				id: 'user_456',
				username: 'charlie@example.com',
				name: 'Charlie',
				displayColor: '#10b981',
				profileImage: 'https://example.com/avatar.jpg',
				isRemote: true,
				externalActorUrl: 'https://example.com/users/charlie',
			}

			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
					organizers: [{ url: 'https://example.com/users/charlie', username: 'charlie' }],
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue([mockOrganizer] as any)

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).organizers[0]).toMatchObject({
				url: 'https://example.com/users/charlie',
				username: 'charlie@example.com',
				name: 'Charlie',
				profileImage: 'https://example.com/avatar.jpg',
			})
		})

		it('handles multiple events with different external URLs', async () => {
			const mockUsers = [
				{
					id: 'user_123',
					username: 'bob@example.com',
					name: 'Bob',
					displayColor: '#3b82f6',
					profileImage: null,
					isRemote: true,
					externalActorUrl: 'https://example.com/users/bob',
				},
				{
					id: 'user_456',
					username: 'charlie@example.com',
					name: 'Charlie',
					displayColor: '#10b981',
					profileImage: null,
					isRemote: true,
					externalActorUrl: 'https://example.com/users/charlie',
				},
			]

			const events = [
				{
					id: '1',
					user: null,
					attributedTo: 'https://example.com/users/bob',
				},
				{
					id: '2',
					user: null,
					attributedTo: 'https://example.com/users/charlie',
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).user).toMatchObject({ username: 'bob@example.com' })
			expect((result[1] as any).user).toMatchObject({ username: 'charlie@example.com' })
		})

		it('normalizes organizer URLs with trailing slashes', async () => {
			const mockOrganizer = {
				id: 'user_456',
				username: 'charlie@example.com',
				name: 'Charlie',
				displayColor: '#10b981',
				profileImage: 'https://example.com/avatar.jpg',
				isRemote: true,
				externalActorUrl: 'https://example.com/users/charlie',
			}

			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
					organizers: [
						{ url: 'https://example.com/users/charlie/', username: 'charlie' },
					],
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue([mockOrganizer] as any)

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).organizers[0]).toMatchObject({
				url: 'https://example.com/users/charlie/',
				username: 'charlie@example.com',
				name: 'Charlie',
			})
		})

		it('keeps organizer unchanged when user not found in DB', async () => {
			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
					organizers: [{ url: 'https://example.com/users/unknown', username: 'unknown' }],
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue([])

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).organizers[0]).toEqual({
				url: 'https://example.com/users/unknown',
				username: 'unknown',
			})
		})

		it('handles events with no organizers array', async () => {
			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
					organizers: undefined,
				},
			] as any

			const result = await hydrateEventUsers(events)

			expect(result).toEqual(events)
		})

		it('handles empty events array', async () => {
			const events: any[] = []

			const result = await hydrateEventUsers(events)

			expect(result).toEqual([])
			expect(prisma.user.findMany).not.toHaveBeenCalled()
		})

		it('handles events with empty organizers array', async () => {
			const events = [
				{
					id: '1',
					user: { id: 'user1', username: 'alice' },
					attributedTo: null,
					organizers: [],
				},
			] as any

			const result = await hydrateEventUsers(events)

			expect(result).toEqual(events)
		})

		it('collects URLs from both attributedTo and organizers', async () => {
			const mockUsers = [
				{
					id: 'user_123',
					username: 'bob@example.com',
					name: 'Bob',
					displayColor: '#3b82f6',
					profileImage: null,
					isRemote: true,
					externalActorUrl: 'https://example.com/users/bob',
				},
				{
					id: 'user_456',
					username: 'charlie@example.com',
					name: 'Charlie',
					displayColor: '#10b981',
					profileImage: null,
					isRemote: true,
					externalActorUrl: 'https://example.com/users/charlie',
				},
			]

			const events = [
				{
					id: '1',
					user: null,
					attributedTo: 'https://example.com/users/bob',
					organizers: [{ url: 'https://example.com/users/charlie', username: 'charlie' }],
				},
			] as any

			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

			const result = await hydrateEventUsers(events)

			expect((result[0] as any).user).toMatchObject({ username: 'bob@example.com' })
			expect((result[0] as any).organizers[0]).toMatchObject({
				username: 'charlie@example.com',
			})
		})
	})
})
