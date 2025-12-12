/**
 * Tests for Authentication Setup
 * Tests for generateUserKeys and better-auth configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateUserKeys } from '../auth.js'
import { prisma } from '../lib/prisma.js'
import { encryptPrivateKey } from '../lib/encryption.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			update: vi.fn(),
		},
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

	describe('better-auth configuration', () => {
		it('should export auth instance', async () => {
			const { auth } = await import('../auth.js')
			expect(auth).toBeDefined()
			expect(auth.handler).toBeDefined()
		})
	})
})
