/**
 * Tests for Authentication Setup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { generateUserKeys } from '../auth.js'
import { prisma } from '../lib/prisma.js'
import * as encryption from '../lib/encryption.js'

// Mock encryption
vi.mock('../lib/encryption.js')

describe('Auth', () => {
    let testUser: any

    beforeEach(async () => {
        // Clean up
        await prisma.user.deleteMany({})

        // Create test user with unique identifiers to avoid race conditions in parallel tests
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(7)
        testUser = await prisma.user.create({
            data: {
                username: `alice_${timestamp}_${randomSuffix}`,
                email: `alice_${timestamp}_${randomSuffix}@test.com`,
                name: 'Alice Test',
                isRemote: false,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('generateUserKeys', () => {
        it('should generate and store RSA key pair for user', async () => {
            // Ensure user exists before generating keys
            const user = await prisma.user.findUnique({ where: { id: testUser.id } })
            if (!user) {
                throw new Error('Test user not found')
            }

            const mockEncryptedKey = 'encrypted-private-key'
            vi.mocked(encryption.encryptPrivateKey).mockReturnValue(mockEncryptedKey)

            await generateUserKeys(testUser.id, testUser.username)

            // Verify keys were generated and stored
            const updatedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
                select: {
                    publicKey: true,
                    privateKey: true,
                },
            })

            expect(updatedUser).not.toBeNull()
            expect(updatedUser!.publicKey).toBeTruthy()
            expect(updatedUser!.privateKey).toBe(mockEncryptedKey)
            expect(updatedUser!.publicKey).toContain('BEGIN PUBLIC KEY')
            expect(updatedUser!.publicKey).toContain('END PUBLIC KEY')
        })

        it('should encrypt private key before storing', async () => {
            const mockEncryptedKey = 'encrypted-private-key'
            vi.mocked(encryption.encryptPrivateKey).mockReturnValue(mockEncryptedKey)

            // Ensure user exists before generating keys
            const user = await prisma.user.findUnique({ where: { id: testUser.id } })
            if (!user) {
                throw new Error('Test user not found')
            }

            await generateUserKeys(testUser.id, testUser.username)

            // Verify encryptPrivateKey was called
            expect(encryption.encryptPrivateKey).toHaveBeenCalled()
            const callArgs = vi.mocked(encryption.encryptPrivateKey).mock.calls[0][0]
            expect(callArgs).toContain('BEGIN PRIVATE KEY')
            expect(callArgs).toContain('END PRIVATE KEY')

            // Verify encrypted key was stored
            const updatedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
                select: { privateKey: true },
            })
            expect(updatedUser!.privateKey).toBe(mockEncryptedKey)
        })

        it('should generate 2048-bit RSA keys', async () => {
            vi.mocked(encryption.encryptPrivateKey).mockReturnValue('encrypted-key')

            await generateUserKeys(testUser.id, testUser.username)

            const updatedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
                select: { publicKey: true },
            })

            // RSA 2048-bit public keys are typically around 450-500 characters in PEM format
            expect(updatedUser!.publicKey.length).toBeGreaterThan(400)
            expect(updatedUser!.publicKey.length).toBeLessThan(600)
        })

        it('should handle errors during key generation', async () => {
            vi.mocked(encryption.encryptPrivateKey).mockImplementation(() => {
                throw new Error('Encryption failed')
            })

            await expect(generateUserKeys(testUser.id, testUser.username)).rejects.toThrow()

            // Verify user was not updated
            const user = await prisma.user.findUnique({
                where: { id: testUser.id },
                select: { publicKey: true, privateKey: true },
            })
            expect(user!.publicKey).toBeNull()
            expect(user!.privateKey).toBeNull()
        })

        it('should update existing user keys', async () => {
            // Set initial keys
            await prisma.user.update({
                where: { id: testUser.id },
                data: {
                    publicKey: 'old-public-key',
                    privateKey: 'old-private-key',
                },
            })

            const mockEncryptedKey = 'new-encrypted-key'
            vi.mocked(encryption.encryptPrivateKey).mockReturnValue(mockEncryptedKey)

            await generateUserKeys(testUser.id, testUser.username)

            const updatedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
                select: {
                    publicKey: true,
                    privateKey: true,
                },
            })

            expect(updatedUser!.publicKey).not.toBe('old-public-key')
            expect(updatedUser!.privateKey).toBe(mockEncryptedKey)
        })
    })
})

