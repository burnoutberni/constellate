/**
 * Tests for user queries hooks
 */

import { describe, it, expect } from 'vitest'
import { QueryClient } from '@tanstack/query-core'
import { queryKeys } from '../../hooks/queries/keys'

describe('queryKeys', () => {
	describe('currentProfile', () => {
		it('should generate correct key structure for current profile', () => {
			const key = queryKeys.users.currentProfile('user-123')
			expect(key).toEqual(['users', 'current', 'profile', 'user-123'])
		})

		it('should generate correct key structure with null userId', () => {
			const key = queryKeys.users.currentProfile(null)
			expect(key).toEqual(['users', 'current', 'profile', null])
		})

		it('should generate correct key structure with undefined userId', () => {
			const key = queryKeys.users.currentProfile(undefined)
			expect(key).toEqual(['users', 'current', 'profile', null])
		})
	})

	describe('profile', () => {
		it('should generate correct key structure for user profile', () => {
			const key = queryKeys.users.profile('testuser')
			expect(key).toEqual(['users', 'profile', 'testuser'])
		})
	})

	describe('followStatus', () => {
		it('should generate correct key structure for follow status', () => {
			const key = queryKeys.users.followStatus('testuser')
			expect(key).toEqual(['users', 'followStatus', 'testuser'])
		})
	})

	describe('followers', () => {
		it('should generate correct key structure for followers', () => {
			const key = queryKeys.users.followers('testuser')
			expect(key).toEqual(['users', 'followers', 'testuser'])
		})
	})

	describe('following', () => {
		it('should generate correct key structure for following', () => {
			const key = queryKeys.users.following('testuser')
			expect(key).toEqual(['users', 'following', 'testuser'])
		})
	})
})

describe('getCurrentUserFromCache key structure validation', () => {
	it('should validate that currentProfile key has expected structure', () => {
		const userId = 'user-123'
		const key = queryKeys.users.currentProfile(userId)

		expect(key).toHaveLength(4)
		expect(key[0]).toBe('users')
		expect(key[1]).toBe('current')
		expect(key[2]).toBe('profile')
		expect(key[3]).toBe(userId)
	})

	it('should generate correct key when userId is undefined', () => {
		const key = queryKeys.users.currentProfile(undefined)
		expect(key).toEqual(['users', 'current', 'profile', null])
	})

	it('should generate correct key when userId is null', () => {
		const key = queryKeys.users.currentProfile(null)
		expect(key).toEqual(['users', 'current', 'profile', null])
	})

	it('key structure is consistent across different userIds', () => {
		const keys = [
			queryKeys.users.currentProfile('user-1'),
			queryKeys.users.currentProfile('user-2'),
			queryKeys.users.currentProfile('very-long-user-id-12345'),
		]

		keys.forEach((key) => {
			expect(key).toHaveLength(4)
			expect(key[0]).toBe('users')
			expect(key[1]).toBe('current')
			expect(key[2]).toBe('profile')
		})
	})

	it('verifies getCurrentUserFromCache key extraction logic', () => {
		const queryClient = new QueryClient()

		const mockUser = {
			id: 'test-user',
			username: 'testusername',
			name: 'Test User',
		}

		const userId = 'test-user'
		const key = queryKeys.users.currentProfile(userId)
		queryClient.setQueryData(key, mockUser)

		const queries = queryClient.getQueriesData({
			queryKey: queryKeys.users.currentProfile(userId),
		})

		expect(queries).toHaveLength(1)
		expect(queries[0][0]).toEqual(['users', 'current', 'profile', 'test-user'])
		expect(queries[0][1]).toEqual(mockUser)
	})

	it('demonstrates that getQueriesData with undefined userId matches nothing when stored with actual userId', () => {
		const queryClient = new QueryClient()

		const mockUser = { id: 'test-user', username: 'testusername' }
		queryClient.setQueryData(['users', 'current', 'profile', 'test-user'], mockUser)

		const queriesWithNull = queryClient.getQueriesData({
			queryKey: queryKeys.users.currentProfile(undefined),
		})

		const queriesWithUserId = queryClient.getQueriesData({
			queryKey: queryKeys.users.currentProfile('test-user'),
		})

		expect(queriesWithNull).toHaveLength(0)
		expect(queriesWithUserId).toHaveLength(1)

		const currentUserQuery = queriesWithUserId.find(([k]) => {
			if (Array.isArray(k) && k.length >= 4 && k[1] === 'current' && k[2] === 'profile') {
				return k[3] !== null
			}
			return false
		})

		const result = (currentUserQuery?.[1] as { id: string; username: string } | null) ?? null

		expect(result).not.toBeNull()
		expect(result?.id).toBe('test-user')
		expect(result?.username).toBe('testusername')
	})

	it('verifies the getCurrentUserFromCache function finds user with correct filtering', () => {
		const queryClient = new QueryClient()

		const user1 = { id: 'user-1', username: 'user1' }
		const user2 = { id: 'user-2', username: 'user2' }
		const nullUser = { id: 'null-user', username: 'null' }

		queryClient.setQueryData(['users', 'current', 'profile', 'user-1'], user1)
		queryClient.setQueryData(['users', 'current', 'profile', 'user-2'], user2)
		queryClient.setQueryData(['users', 'current', 'profile', null], nullUser)

		const queries = queryClient.getQueriesData({
			queryKey: queryKeys.users.currentProfile('user-1'),
		})

		const currentUserQuery = queries.find(([k]) => {
			if (Array.isArray(k) && k.length >= 4 && k[1] === 'current' && k[2] === 'profile') {
				return k[3] !== null
			}
			return false
		})

		const result = (currentUserQuery?.[1] as { id: string } | null) ?? null

		expect(result).not.toBeNull()
		expect(result?.id).toBe('user-1')
	})

	it('handles empty cache gracefully', () => {
		const queryClient = new QueryClient()

		const queries = queryClient.getQueriesData({
			queryKey: queryKeys.users.currentProfile('any-user'),
		})

		expect(queries).toHaveLength(0)
	})
})
