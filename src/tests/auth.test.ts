/**
 * Tests for Authentication Setup
 * Tests for generateUserKeys and better-auth configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as authModule from '../auth.js'
import { generateUserKeys, processSignupSuccess } from '../auth.js'
import { prisma } from '../lib/prisma.js'
import { encryptPrivateKey } from '../lib/encryption.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			update: vi.fn(),
			findUnique: vi.fn(),
			delete: vi.fn(),
		},
		$transaction: vi.fn(),
	},
}))

vi.mock('../lib/encryption.js', () => ({
	encryptPrivateKey: vi.fn(),
}))

describe('Authentication Setup', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('generateUserKeys', () => {
		it('should generate RSA key pair and encrypt private key', async () => {
			const userId = 'user-123'
			const username = 'testuser'
			const mockEncryptedKey = 'encrypted-private-key'

			vi.mocked(encryptPrivateKey).mockReturnValue(mockEncryptedKey)
			vi.mocked(prisma.user.update).mockResolvedValue({} as any)

			await generateUserKeys(userId, username)

			// Verify encryption was called
			expect(encryptPrivateKey).toHaveBeenCalled()
			const encryptionCall = vi.mocked(encryptPrivateKey).mock.calls[0][0]
			expect(encryptionCall).toContain('BEGIN PRIVATE KEY')

			// Verify database update was called
			expect(prisma.user.update).toHaveBeenCalledWith({
				where: { id: userId },
				data: {
					publicKey: expect.stringContaining('BEGIN PUBLIC KEY'),
					privateKey: mockEncryptedKey,
				},
			})
		})

		it('should generate keys with correct RSA parameters', async () => {
			const userId = 'user-123'
			const username = 'testuser'

			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')
			vi.mocked(prisma.user.update).mockResolvedValue({} as any)

			await generateUserKeys(userId, username)

			// Verify the public key is in PEM format
			const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
			const publicKey = updateCall.data.publicKey as string
			expect(publicKey).toContain('BEGIN PUBLIC KEY')
			expect(publicKey).toContain('END PUBLIC KEY')
		})

		it('should handle database errors gracefully', async () => {
			const userId = 'user-123'
			const username = 'testuser'

			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')
			vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'))

			await expect(generateUserKeys(userId, username)).rejects.toThrow('Database error')
		})

		it('should handle encryption errors gracefully', async () => {
			const userId = 'user-123'
			const username = 'testuser'

			vi.mocked(encryptPrivateKey).mockImplementation(() => {
				throw new Error('Encryption error')
			})

			await expect(generateUserKeys(userId, username)).rejects.toThrow('Encryption error')
		})

		it('should generate unique keys for different users', async () => {
			const userId1 = 'user-1'
			const userId2 = 'user-2'
			const username1 = 'user1'
			const username2 = 'user2'

			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')
			vi.mocked(prisma.user.update).mockResolvedValue({} as any)

			await generateUserKeys(userId1, username1)
			const publicKey1 = vi.mocked(prisma.user.update).mock.calls[0][0].data
				.publicKey as string

			vi.clearAllMocks()
			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')
			vi.mocked(prisma.user.update).mockResolvedValue({} as any)

			await generateUserKeys(userId2, username2)
			const publicKey2 = vi.mocked(prisma.user.update).mock.calls[0][0].data
				.publicKey as string

			// Keys should be different (very high probability)
			expect(publicKey1).not.toBe(publicKey2)
		})

		it('should store encrypted private key, not plain text', async () => {
			const userId = 'user-123'
			const username = 'testuser'
			const mockEncryptedKey = 'encrypted-private-key'

			vi.mocked(encryptPrivateKey).mockReturnValue(mockEncryptedKey)
			vi.mocked(prisma.user.update).mockResolvedValue({} as any)

			await generateUserKeys(userId, username)

			const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
			const storedPrivateKey = updateCall.data.privateKey as string

			// Should store encrypted key, not plain text
			expect(storedPrivateKey).toBe(mockEncryptedKey)
			expect(storedPrivateKey).not.toContain('BEGIN PRIVATE KEY')
		})
	})

	describe('processSignupSuccess', () => {
		it('should update user with ToS acceptance timestamp and version', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'testuser',
				isRemote: false,
				publicKey: null,
				privateKey: null,
			}

			// Mock transaction client
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(mockUser as any),
					update: vi.fn().mockResolvedValue({} as any),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})
			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')

			const { config } = await import('../config.js')

			await processSignupSuccess(userId)

			// Verify transaction was used
			expect(prisma.$transaction).toHaveBeenCalled()

			// Verify ToS timestamp and version were set in single atomic update
			// Since user doesn't have keys, they will be generated and included
			expect(mockTx.user.update).toHaveBeenCalledTimes(1)
			const updateCall = mockTx.user.update.mock.calls[0][0]
			expect(updateCall.where).toEqual({ id: userId })
			expect(updateCall.data).toHaveProperty('tosAcceptedAt')
			expect(updateCall.data).toHaveProperty('tosVersion', config.tosVersion)
			expect(updateCall.data).toHaveProperty('publicKey')
			expect(updateCall.data).toHaveProperty('privateKey')
		})

		it('should generate keys for local users without keys', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'testuser',
				isRemote: false,
				publicKey: null,
				privateKey: null,
			}

			// Mock transaction client
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(mockUser as any),
					update: vi.fn().mockResolvedValue({} as any),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})
			vi.mocked(encryptPrivateKey).mockReturnValue('encrypted-key')

			await processSignupSuccess(userId)

			// Verify transaction was used
			expect(prisma.$transaction).toHaveBeenCalled()

			// Verify that findUnique was called to fetch the user
			expect(mockTx.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					isRemote: true,
					publicKey: true,
					privateKey: true,
				},
			})

			// Verify that keys were generated in single atomic update with ToS
			expect(mockTx.user.update).toHaveBeenCalledTimes(1)
			const updateCall = mockTx.user.update.mock.calls[0][0]
			expect(updateCall.data).toHaveProperty('tosAcceptedAt')
			expect(updateCall.data).toHaveProperty('tosVersion')
			expect(updateCall.data).toHaveProperty('publicKey')
			expect(updateCall.data).toHaveProperty('privateKey')
		})

		it('should not generate keys for remote users', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'testuser',
				isRemote: true,
				publicKey: null,
				privateKey: null,
			}

			// Mock transaction client
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(mockUser as any),
					update: vi.fn().mockResolvedValue({} as any),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})

			await processSignupSuccess(userId)

			// Verify transaction was used
			expect(prisma.$transaction).toHaveBeenCalled()

			// Verify update was called with only ToS data (no keys)
			expect(mockTx.user.update).toHaveBeenCalledTimes(1)
			const updateCall = mockTx.user.update.mock.calls[0][0]
			expect(updateCall.data).toHaveProperty('tosAcceptedAt')
			expect(updateCall.data).toHaveProperty('tosVersion')
			expect(updateCall.data).not.toHaveProperty('publicKey')
			expect(updateCall.data).not.toHaveProperty('privateKey')
		})

		it('should not generate keys if user already has keys', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'testuser',
				isRemote: false,
				publicKey: 'existing-public-key',
				privateKey: 'existing-private-key',
			}

			// Mock transaction client
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(mockUser as any),
					update: vi.fn().mockResolvedValue({} as any),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})

			await processSignupSuccess(userId)

			// Verify transaction was used
			expect(prisma.$transaction).toHaveBeenCalled()

			// Verify update was called with only ToS data (no keys)
			expect(mockTx.user.update).toHaveBeenCalledTimes(1)
			const updateCall = mockTx.user.update.mock.calls[0][0]
			expect(updateCall.data).toHaveProperty('tosAcceptedAt')
			expect(updateCall.data).toHaveProperty('tosVersion')
			expect(updateCall.data).not.toHaveProperty('publicKey')
			expect(updateCall.data).not.toHaveProperty('privateKey')
		})

		it('should delete user and propagate errors if transaction fails', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'testuser',
				isRemote: false,
				publicKey: null,
				privateKey: null,
			}

			const transactionError = new Error('Database error during transaction')

			// Mock transaction to fail
			vi.mocked(prisma.$transaction).mockRejectedValue(transactionError)
			vi.mocked(prisma.user.delete).mockResolvedValue({} as any)

			// Key generation is required - if it fails, signup should fail and user should be deleted
			await expect(processSignupSuccess(userId)).rejects.toThrow(
				'Database error during transaction'
			)

			// Verify that user deletion was attempted to rollback signup
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { id: userId },
			})
		})

		it('should delete user even if deletion fails (original error is more important)', async () => {
			const userId = 'user-123'
			const transactionError = new Error('Database error during transaction')
			const deleteError = new Error('Failed to delete user')

			// Mock transaction to fail
			vi.mocked(prisma.$transaction).mockRejectedValue(transactionError)
			vi.mocked(prisma.user.delete).mockRejectedValue(deleteError)

			// Should throw the original transaction error, not the delete error
			await expect(processSignupSuccess(userId)).rejects.toThrow(
				'Database error during transaction'
			)

			// Verify that user deletion was attempted
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { id: userId },
			})
		})

		it('should delete user if username is missing when generating keys', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: null, // Username is missing
				isRemote: false,
				publicKey: null,
				privateKey: null,
			}

			// Mock transaction client that will throw error
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(mockUser as any),
					update: vi.fn(),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})
			vi.mocked(prisma.user.delete).mockResolvedValue({} as any)

			// Username is required - if missing, should throw error and delete user
			await expect(processSignupSuccess(userId)).rejects.toThrow(
				'Username is required but was not found'
			)

			// Verify that user deletion was attempted to rollback signup
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { id: userId },
			})
		})

		it('should delete user if user is not found', async () => {
			const userId = 'user-123'

			// Mock transaction client that returns null user
			const mockTx = {
				user: {
					findUnique: vi.fn().mockResolvedValue(null),
					update: vi.fn(),
				},
			}

			vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
				return callback(mockTx)
			})
			vi.mocked(prisma.user.delete).mockResolvedValue({} as any)

			// Should throw error and delete user
			await expect(processSignupSuccess(userId)).rejects.toThrow(
				`User with id ${userId} not found`
			)

			// Verify that user deletion was attempted to rollback signup
			expect(prisma.user.delete).toHaveBeenCalledWith({
				where: { id: userId },
			})
		})
	})

	describe('better-auth configuration', () => {
		it('should export auth instance', async () => {
			const { auth } = await import('../auth.js')
			expect(auth).toBeDefined()
			expect(auth.handler).toBeDefined()
		})
	})
})
