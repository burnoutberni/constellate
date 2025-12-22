/**
 * Tests for Privacy Helper Functions
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { canViewPrivateProfile } from '../../lib/privacy.js'

describe('Privacy Helper Functions', () => {
	let testUser: any
	let privateUser: any
	let remoteUser: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		await prisma.following.deleteMany({})
		await prisma.follower.deleteMany({})
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
				isPublicProfile: true,
			},
		})

		privateUser = await prisma.user.create({
			data: {
				username: `private_${suffix}`,
				email: `private_${suffix}@test.com`,
				name: 'Private User',
				isRemote: false,
				isPublicProfile: false,
			},
		})

		remoteUser = await prisma.user.create({
			data: {
				username: `remote_${suffix}@remote.com`,
				name: 'Remote User',
				isRemote: true,
				externalActorUrl: 'https://remote.com/users/remote',
				inboxUrl: 'https://remote.com/users/remote/inbox',
				isPublicProfile: false,
			},
		})
	})

	describe('canViewPrivateProfile', () => {
		it('should return true for public profiles', async () => {
			const result = await canViewPrivateProfile({
				profileUserId: testUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: testUser.username,
				profileIsPublic: true,
			})

			expect(result).toBe(true)
		})

		it('should return true when viewer is the profile owner (by ID)', async () => {
			const result = await canViewPrivateProfile({
				viewerId: privateUser.id,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(true)
		})

		it('should return true when viewer is the profile owner (by actor URL)', async () => {
			const profileActorUrl = `${baseUrl}/users/${privateUser.username}`
			const result = await canViewPrivateProfile({
				viewerActorUrl: profileActorUrl,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(true)
		})

		it('should return false for private profiles when viewer is not authenticated', async () => {
			const result = await canViewPrivateProfile({
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})

		it('should return false for private profiles when viewer is not owner and not a follower', async () => {
			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})

		it('should return true for private profiles when viewer is an accepted follower', async () => {
			const profileActorUrl = `${baseUrl}/users/${privateUser.username}`

			// Create following relationship
			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: profileActorUrl,
					username: privateUser.username,
					inboxUrl: `${baseUrl}/users/${privateUser.username}/inbox`,
					accepted: true,
				},
			})

			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(true)
		})

		it('should return false for private profiles when viewer is a pending follower', async () => {
			const profileActorUrl = `${baseUrl}/users/${privateUser.username}`

			// Create pending following relationship
			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: profileActorUrl,
					username: privateUser.username,
					inboxUrl: `${baseUrl}/users/${privateUser.username}/inbox`,
					accepted: false,
				},
			})

			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})

		it('should handle remote users correctly', async () => {
			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: remoteUser.id,
				profileIsRemote: true,
				profileExternalActorUrl: 'https://remote.com/users/remote',
				profileUsername: remoteUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})

		it('should return true for remote users when viewer is an accepted follower', async () => {
			// Create following relationship with remote user
			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: 'https://remote.com/users/remote',
					username: remoteUser.username,
					inboxUrl: 'https://remote.com/users/remote/inbox',
					accepted: true,
				},
			})

			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: remoteUser.id,
				profileIsRemote: true,
				profileExternalActorUrl: 'https://remote.com/users/remote',
				profileUsername: remoteUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(true)
		})

		it('should resolve viewer ID from actor URL when only actor URL is provided', async () => {
			const profileActorUrl = `${baseUrl}/users/${privateUser.username}`
			const viewerActorUrl = `${baseUrl}/users/${testUser.username}`

			// Create following relationship
			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: profileActorUrl,
					username: privateUser.username,
					inboxUrl: `${baseUrl}/users/${privateUser.username}/inbox`,
					accepted: true,
				},
			})

			const result = await canViewPrivateProfile({
				viewerActorUrl: viewerActorUrl,
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(true)
		})

		it('should return false when profile actor URL cannot be built', async () => {
			const result = await canViewPrivateProfile({
				viewerId: testUser.id,
				profileUserId: remoteUser.id,
				profileIsRemote: true,
				profileExternalActorUrl: null, // Missing external actor URL
				profileUsername: remoteUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})

		it('should return false when viewer actor URL does not match any user', async () => {
			const result = await canViewPrivateProfile({
				viewerActorUrl: 'https://unknown.com/users/nonexistent',
				profileUserId: privateUser.id,
				profileIsRemote: false,
				profileExternalActorUrl: null,
				profileUsername: privateUser.username,
				profileIsPublic: false,
			})

			expect(result).toBe(false)
		})
	})
})
