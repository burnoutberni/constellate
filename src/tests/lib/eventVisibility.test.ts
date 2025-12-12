import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
	buildVisibilityWhere,
	canUserViewEvent,
	resolveEventActorUrl,
	isPublicVisibility,
} from '../../lib/eventVisibility.js'
import { prisma } from '../../lib/prisma.js'

// Mock dependencies (prisma is already mocked in setupVitest.ts)

describe('eventVisibility helpers', () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	describe('buildVisibilityWhere', () => {
		it('returns public filter when user is not provided', () => {
			const filter = buildVisibilityWhere()
			expect(filter).toEqual({ visibility: 'PUBLIC' })
		})

		it('includes owner, public, followed actors, and optional unlisted flag', () => {
			const filter = buildVisibilityWhere({
				userId: 'user_123',
				followedActorUrls: ['https://remote/users/alice'],
				includeUnlisted: true,
			})

			expect(filter).toEqual({
				OR: [
					{ visibility: 'PUBLIC' },
					{ userId: 'user_123' },
					{ visibility: 'UNLISTED' },
					{
						visibility: 'FOLLOWERS',
						attributedTo: { in: ['https://remote/users/alice'] },
					},
				],
			})
		})
	})

	describe('resolveEventActorUrl', () => {
		it('prefers attributedTo when present', () => {
			const url = resolveEventActorUrl({ attributedTo: 'https://remote/users/bob' })
			expect(url).toBe('https://remote/users/bob')
		})

		it('falls back to local user username', () => {
			const url = resolveEventActorUrl({
				user: { username: 'carol' },
			})
			expect(url).toMatch(/\/users\/carol$/)
		})
	})

	describe('canUserViewEvent', () => {
		it('allows public and unlisted events for everyone', async () => {
			await expect(canUserViewEvent({ visibility: 'PUBLIC' }, undefined)).resolves.toBe(true)
			await expect(canUserViewEvent({ visibility: 'UNLISTED' }, undefined)).resolves.toBe(
				true
			)
		})

		it('allows owners to see their private events', async () => {
			await expect(
				canUserViewEvent({ visibility: 'PRIVATE', userId: 'owner' }, 'owner')
			).resolves.toBe(true)
		})

		it('blocks private events for other users', async () => {
			await expect(
				canUserViewEvent({ visibility: 'PRIVATE', userId: 'owner' }, 'viewer')
			).resolves.toBe(false)
		})

		it('checks follower relationship for follower-only events', async () => {
			vi.mocked(prisma.following.findFirst).mockResolvedValue({ id: 'follow_1' } as any)
			await expect(
				canUserViewEvent(
					{
						visibility: 'FOLLOWERS',
						attributedTo: 'https://remote/users/alice',
					},
					'viewer'
				)
			).resolves.toBe(true)

			vi.mocked(prisma.following.findFirst).mockResolvedValue(null)
			await expect(
				canUserViewEvent(
					{
						visibility: 'FOLLOWERS',
						attributedTo: 'https://remote/users/alice',
					},
					'viewer'
				)
			).resolves.toBe(false)
		})
	})

	describe('isPublicVisibility', () => {
		it('treats undefined as public by default', () => {
			expect(isPublicVisibility()).toBe(true)
			expect(isPublicVisibility('PUBLIC')).toBe(true)
			expect(isPublicVisibility('PRIVATE')).toBe(false)
		})
	})
})
