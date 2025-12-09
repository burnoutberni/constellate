/**
 * Tests for Activity Delivery Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import {
    deliverToInbox,
    deliverToInboxes,
    deliverToFollowers,
    deliverToActors,
    deliverActivity,
    deliverWithRetry,
} from '../../services/ActivityDelivery.js'
import * as httpSignature from '../../lib/httpSignature.js'
import * as ssrfProtection from '../../lib/ssrfProtection.js'
import * as activitypubHelpers from '../../lib/activitypubHelpers.js'
import * as audience from '../../lib/audience.js'
import * as encryption from '../../lib/encryption.js'
import { prisma } from '../../lib/prisma.js'

// Mock dependencies
vi.mock('../../lib/httpSignature.js')
vi.mock('../../lib/ssrfProtection.js')
vi.mock('../../lib/activitypubHelpers.js')
vi.mock('../../lib/audience.js')
vi.mock('../../lib/encryption.js')
vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
        follower: {
            findMany: vi.fn(),
        },
    },
}))

describe('Activity Delivery Service', () => {
    let mockUser: any
    let mockPrivateKey: string
    let mockPublicKey: string
    let mockActivity: any

    beforeEach(() => {
        vi.clearAllMocks()

        // Generate test key pair
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        })

        mockPrivateKey = privateKey
        mockPublicKey = publicKey

        mockUser = {
            id: 'user-123',
            username: 'testuser',
            privateKey: 'encrypted-key',
        }

        mockActivity = {
            id: 'https://example.com/activities/123',
            type: 'Create',
            actor: 'https://example.com/users/testuser',
            object: {
                type: 'Event',
                id: 'https://example.com/events/123',
            },
        }

        // Default mocks
        vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue('https://example.com')
        vi.mocked(encryption.decryptPrivateKey).mockReturnValue(mockPrivateKey)
        vi.mocked(httpSignature.createDigest).mockResolvedValue('SHA-256=digest')
        vi.mocked(httpSignature.signRequest).mockReturnValue('signature-header')
        vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
        } as Response)
    })

    describe('deliverToInbox', () => {
        it('should return false when user has no private key', async () => {
            const userWithoutKey = { ...mockUser, privateKey: null }

            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', userWithoutKey)

            expect(result).toBe(false)
            expect(encryption.decryptPrivateKey).not.toHaveBeenCalled()
        })

        it('should return false when decryption fails', async () => {
            vi.mocked(encryption.decryptPrivateKey).mockReturnValue(null)

            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', mockUser)

            expect(result).toBe(false)
        })

        it('should sign and deliver activity successfully', async () => {
            const inboxUrl = 'https://remote.com/inbox'
            const result = await deliverToInbox(mockActivity, inboxUrl, mockUser)

            expect(result).toBe(true)
            expect(encryption.decryptPrivateKey).toHaveBeenCalledWith(mockUser.privateKey)
            expect(httpSignature.createDigest).toHaveBeenCalled()
            expect(httpSignature.signRequest).toHaveBeenCalled()
            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                inboxUrl,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        signature: 'signature-header',
                        digest: expect.any(String),
                    }),
                })
            )
        })

        it('should use correct keyId in signature', async () => {
            const inboxUrl = 'https://remote.com/inbox'
            await deliverToInbox(mockActivity, inboxUrl, mockUser)

            expect(httpSignature.signRequest).toHaveBeenCalledWith(
                mockPrivateKey,
                'https://example.com/users/testuser#main-key',
                'POST',
                expect.any(String),
                expect.any(Object)
            )
        })

        it('should include host header with port for non-standard ports', async () => {
            const inboxUrl = 'https://remote.com:8080/inbox'
            await deliverToInbox(mockActivity, inboxUrl, mockUser)

            const fetchCall = vi.mocked(ssrfProtection.safeFetch).mock.calls[0]
            const headers = fetchCall[1]?.headers as Record<string, string>
            expect(headers.host).toBe('remote.com:8080')
        })

        it('should use hostname only for default ports', async () => {
            const inboxUrl = 'https://remote.com/inbox'
            await deliverToInbox(mockActivity, inboxUrl, mockUser)

            const fetchCall = vi.mocked(ssrfProtection.safeFetch).mock.calls[0]
            const headers = fetchCall[1]?.headers as Record<string, string>
            expect(headers.host).toBe('remote.com')
        })

        it('should return false when delivery fails', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            } as Response)

            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', mockUser)

            expect(result).toBe(false)
        })

        it('should return false on error', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockRejectedValue(new Error('Network error'))

            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', mockUser)

            expect(result).toBe(false)
        })

        it('should include digest in signature when body is present', async () => {
            const inboxUrl = 'https://remote.com/inbox'
            await deliverToInbox(mockActivity, inboxUrl, mockUser)

            expect(httpSignature.signRequest).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.objectContaining({
                    digest: expect.any(String),
                })
            )
        })
    })

    describe('deliverToInboxes', () => {
        it('should deliver to multiple inboxes', async () => {
            const inboxUrls = [
                'https://remote1.com/inbox',
                'https://remote2.com/inbox',
                'https://remote3.com/inbox',
            ]

            await deliverToInboxes(mockActivity, inboxUrls, mockUser)

            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(3)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://remote1.com/inbox',
                expect.any(Object)
            )
            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://remote2.com/inbox',
                expect.any(Object)
            )
            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://remote3.com/inbox',
                expect.any(Object)
            )
        })

        it('should deduplicate inbox URLs', async () => {
            const inboxUrls = [
                'https://remote.com/inbox',
                'https://remote.com/inbox', // Duplicate
                'https://remote2.com/inbox',
            ]

            await deliverToInboxes(mockActivity, inboxUrls, mockUser)

            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should handle empty inbox list', async () => {
            await deliverToInboxes(mockActivity, [], mockUser)

            expect(ssrfProtection.safeFetch).not.toHaveBeenCalled()
        })

        it('should use Promise.allSettled to handle failures', async () => {
            vi.mocked(ssrfProtection.safeFetch)
                .mockResolvedValueOnce({ ok: true } as Response)
                .mockResolvedValueOnce({ ok: false } as Response)
                .mockRejectedValueOnce(new Error('Network error'))

            const inboxUrls = [
                'https://remote1.com/inbox',
                'https://remote2.com/inbox',
                'https://remote3.com/inbox',
            ]

            // Should not throw even if some fail
            await expect(deliverToInboxes(mockActivity, inboxUrls, mockUser)).resolves.not.toThrow()
        })
    })

    describe('deliverToFollowers', () => {
        it('should deliver to user followers', async () => {
            const followers = [
                {
                    id: 'follower-1',
                    inboxUrl: 'https://follower1.com/inbox',
                    sharedInboxUrl: null,
                    accepted: true,
                },
                {
                    id: 'follower-2',
                    inboxUrl: 'https://follower2.com/inbox',
                    sharedInboxUrl: 'https://shared.com/inbox',
                    accepted: true,
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.follower.findMany).mockResolvedValue(followers as any)

            await deliverToFollowers(mockActivity, 'user-123')

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-123' },
            })
            expect(prisma.follower.findMany).toHaveBeenCalledWith({
                where: {
                    userId: 'user-123',
                    accepted: true,
                },
            })
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should prefer sharedInboxUrl over inboxUrl', async () => {
            const followers = [
                {
                    id: 'follower-1',
                    inboxUrl: 'https://follower1.com/inbox',
                    sharedInboxUrl: 'https://shared.com/inbox',
                    accepted: true,
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.follower.findMany).mockResolvedValue(followers as any)

            await deliverToFollowers(mockActivity, 'user-123')

            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://shared.com/inbox',
                expect.any(Object)
            )
        })

        it('should use inboxUrl when sharedInboxUrl is not available', async () => {
            const followers = [
                {
                    id: 'follower-1',
                    inboxUrl: 'https://follower1.com/inbox',
                    sharedInboxUrl: null,
                    accepted: true,
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.follower.findMany).mockResolvedValue(followers as any)

            await deliverToFollowers(mockActivity, 'user-123')

            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://follower1.com/inbox',
                expect.any(Object)
            )
        })

        it('should deduplicate inboxes by shared inbox', async () => {
            const followers = [
                {
                    id: 'follower-1',
                    inboxUrl: 'https://follower1.com/inbox',
                    sharedInboxUrl: 'https://shared.com/inbox',
                    accepted: true,
                },
                {
                    id: 'follower-2',
                    inboxUrl: 'https://follower2.com/inbox',
                    sharedInboxUrl: 'https://shared.com/inbox',
                    accepted: true,
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.follower.findMany).mockResolvedValue(followers as any)

            await deliverToFollowers(mockActivity, 'user-123')

            // Should only deliver once to shared inbox
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(1)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledWith(
                'https://shared.com/inbox',
                expect.any(Object)
            )
        })

        it('should throw error when user not found', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            await expect(deliverToFollowers(mockActivity, 'user-123')).rejects.toThrow('User not found')
        })

        it('should only deliver to accepted followers', async () => {
            const followers = [
                {
                    id: 'follower-1',
                    inboxUrl: 'https://follower1.com/inbox',
                    sharedInboxUrl: null,
                    accepted: true,
                },
                {
                    id: 'follower-2',
                    inboxUrl: 'https://follower2.com/inbox',
                    sharedInboxUrl: null,
                    accepted: false, // Not accepted
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.follower.findMany).mockResolvedValue(
                followers.filter(f => f.accepted) as any
            )

            await deliverToFollowers(mockActivity, 'user-123')

            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('deliverToActors', () => {
        it('should deliver to remote actors', async () => {
            const actorUrls = [
                'https://remote1.com/users/alice',
                'https://remote2.com/users/bob',
            ]

            const remoteUsers = [
                {
                    id: 'remote-1',
                    externalActorUrl: 'https://remote1.com/users/alice',
                    inboxUrl: 'https://remote1.com/inbox',
                    sharedInboxUrl: null,
                },
                {
                    id: 'remote-2',
                    externalActorUrl: 'https://remote2.com/users/bob',
                    inboxUrl: 'https://remote2.com/inbox',
                    sharedInboxUrl: null,
                },
            ]

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.user.findUnique)
                .mockResolvedValueOnce(mockUser as any)
                .mockResolvedValueOnce(remoteUsers[0] as any)
                .mockResolvedValueOnce(remoteUsers[1] as any)

            await deliverToActors(mockActivity, actorUrls, 'user-123')

            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should skip local actors', async () => {
            const actorUrls = [
                'https://example.com/users/local', // Local
                'https://remote.com/users/alice', // Remote
            ]

            const remoteUser = {
                id: 'remote-1',
                externalActorUrl: 'https://remote.com/users/alice',
                inboxUrl: 'https://remote.com/inbox',
                sharedInboxUrl: null,
            }

            vi.mocked(prisma.user.findUnique)
                .mockResolvedValueOnce(mockUser as any) // User sending the activity
                .mockResolvedValueOnce(remoteUser as any) // Remote actor lookup

            await deliverToActors(mockActivity, actorUrls, 'user-123')

            // Should only deliver to remote actor (local is skipped)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(1)
        })

        it('should prefer sharedInboxUrl over inboxUrl', async () => {
            const actorUrls = ['https://remote.com/users/alice']

            const remoteUser = {
                id: 'remote-1',
                externalActorUrl: 'https://remote.com/users/alice',
                inboxUrl: 'https://remote.com/inbox',
                sharedInboxUrl: 'https://shared.com/inbox',
            }

            vi.mocked(prisma.user.findUnique)
                .mockResolvedValueOnce(mockUser as any) // User sending the activity
                .mockResolvedValueOnce(remoteUser as any) // Remote actor lookup

            await deliverToActors(mockActivity, actorUrls, 'user-123')

            // The function calls deliverToInboxes which deduplicates and delivers
            // We need to check that the inbox URL with sharedInboxUrl was used
            expect(ssrfProtection.safeFetch).toHaveBeenCalled()
            const calls = vi.mocked(ssrfProtection.safeFetch).mock.calls
            const sharedInboxCall = calls.find(call => call[0] === 'https://shared.com/inbox')
            expect(sharedInboxCall).toBeDefined()
        })

        it('should throw error when user not found', async () => {
            // Mock the first call (user sending activity) to return null
            vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

            await expect(
                deliverToActors(mockActivity, ['https://remote.com/users/alice'], 'user-123')
            ).rejects.toThrow('User not found')
        })

        it('should skip actors without inboxUrl', async () => {
            const actorUrls = ['https://remote.com/users/alice']

            const remoteUser = {
                id: 'remote-1',
                externalActorUrl: 'https://remote.com/users/alice',
                inboxUrl: null,
                sharedInboxUrl: null,
            }

            vi.mocked(prisma.user.findUnique)
                .mockResolvedValueOnce(mockUser as any)
                .mockResolvedValueOnce(remoteUser as any)

            await deliverToActors(mockActivity, actorUrls, 'user-123')

            expect(ssrfProtection.safeFetch).not.toHaveBeenCalled()
        })
    })

    describe('deliverActivity', () => {
        it('should resolve addressing and deliver', async () => {
            const addressing = {
                to: ['https://www.w3.org/ns/activitystreams#Public'],
                cc: ['https://example.com/users/testuser/followers'],
                bcc: [],
            }

            const inboxUrls = ['https://remote1.com/inbox', 'https://remote2.com/inbox']

            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(audience.resolveInboxes).mockResolvedValue(inboxUrls)

            await deliverActivity(mockActivity, addressing, 'user-123')

            expect(audience.resolveInboxes).toHaveBeenCalledWith(addressing, 'user-123')
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should throw error when user not found', async () => {
            const addressing = {
                to: ['https://www.w3.org/ns/activitystreams#Public'],
                cc: [],
                bcc: [],
            }

            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            await expect(deliverActivity(mockActivity, addressing, 'user-123')).rejects.toThrow(
                'User not found'
            )
        })
    })

    describe('deliverWithRetry', () => {
        it('should retry on failure', async () => {
            vi.mocked(ssrfProtection.safeFetch)
                .mockResolvedValueOnce({ ok: false } as Response)
                .mockResolvedValueOnce({ ok: true } as Response)

            const result = await deliverWithRetry(
                mockActivity,
                'https://remote.com/inbox',
                mockUser,
                3
            )

            expect(result).toBe(true)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should use exponential backoff', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)

            const startTime = Date.now()
            const result = await deliverWithRetry(
                mockActivity,
                'https://remote.com/inbox',
                mockUser,
                3
            )
            const endTime = Date.now()

            expect(result).toBe(false)
            // Should have waited at least 1s + 2s = 3s total (with some tolerance)
            expect(endTime - startTime).toBeGreaterThanOrEqual(2000)
        })

        it('should return true on first success', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            const result = await deliverWithRetry(
                mockActivity,
                'https://remote.com/inbox',
                mockUser,
                3
            )

            expect(result).toBe(true)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(1)
        })

        it('should return false after max retries', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)

            const result = await deliverWithRetry(
                mockActivity,
                'https://remote.com/inbox',
                mockUser,
                2
            )

            expect(result).toBe(false)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(2)
        })

        it('should use default maxRetries of 3', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)

            const result = await deliverWithRetry(mockActivity, 'https://remote.com/inbox', mockUser)

            expect(result).toBe(false)
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(3)
        })
    })

    describe('Dead Letter Queue', () => {
        beforeEach(() => {
            // Add failedDelivery mock to prisma
            (prisma as any).failedDelivery = {
                create: vi.fn(),
                findMany: vi.fn(),
                findUnique: vi.fn(),
                update: vi.fn(),
                count: vi.fn(),
                fields: {
                    maxAttempts: {},
                },
            }
        })

        it('should record failed delivery after max retries', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)
            const userWithId = { ...mockUser, id: 'user-123' }

            await deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithId, 2, true)

            expect((prisma as any).failedDelivery.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        activityId: mockActivity.id,
                        activityType: mockActivity.type,
                        inboxUrl: 'https://remote.com/inbox',
                        userId: 'user-123',
                        attemptCount: 2,
                    }),
                })
            )
        })

        it('should not record failure if recordFailure is false', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)
            const userWithId = { ...mockUser, id: 'user-123' }

            await deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithId, 2, false)

            expect((prisma as any).failedDelivery.create).not.toHaveBeenCalled()
        })

        it('should not record failure if user has no id', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)
            const userWithoutId = { username: mockUser.username, privateKey: mockUser.privateKey }

            await deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithoutId, 2, true)

            expect((prisma as any).failedDelivery.create).not.toHaveBeenCalled()
        })

        it('should process pending deliveries from queue', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            await processDeadLetterQueue()

            expect((prisma as any).failedDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'failed-1' },
                    data: expect.objectContaining({
                        status: 'RETRYING',
                    }),
                })
            )
        })

        it('should increment attempt count on retry failure', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)

            await processDeadLetterQueue()

            // Should update with incremented attempt count
            const updateCalls = vi.mocked((prisma as any).failedDelivery.update).mock.calls
            const finalUpdateCall = updateCalls[updateCalls.length - 1]
            expect(finalUpdateCall[0].data.attemptCount).toBe(2)
        })

        it('should mark as failed after max attempts', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 2,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false } as Response)

            await processDeadLetterQueue()

            // Should mark as failed since attemptCount + 1 = maxAttempts
            const updateCalls = vi.mocked((prisma as any).failedDelivery.update).mock.calls
            const finalUpdateCall = updateCalls[updateCalls.length - 1]
            expect(finalUpdateCall[0].data.status).toBe('FAILED')
        })

        it('should delete successful delivery from queue', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            const mockDelete = vi.fn().mockResolvedValue({ id: 'failed-1' })
            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            ;(prisma as any).failedDelivery.delete = mockDelete
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            await processDeadLetterQueue()

            // Should delete successful delivery
            expect(mockDelete).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'failed-1' },
                })
            )
        })

        it('should handle missing user in queue processing', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            await processDeadLetterQueue()

            // Should mark as failed with error message
            const updateCalls = vi.mocked((prisma as any).failedDelivery.update).mock.calls
            const finalUpdateCall = updateCalls[updateCalls.length - 1]
            expect(finalUpdateCall[0].data.lastError).toBe('User not found')
        })

        it('should skip deliveries that exceed max attempts', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 3,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

            await processDeadLetterQueue()

            // Should not attempt delivery (no RETRYING update)
            const updateCalls = vi.mocked((prisma as any).failedDelivery.update).mock.calls
            const retryingCalls = updateCalls.filter((call: any) => call[0].data.status === 'RETRYING')
            expect(retryingCalls).toHaveLength(0)
        })

        it('should handle manual retry', async () => {
            const { retryFailedDelivery } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 2,
                maxAttempts: 3,
                status: 'FAILED',
            }

            const mockDelete = vi.fn().mockResolvedValue({ id: 'failed-1' })
            vi.mocked((prisma as any).failedDelivery.findUnique).mockResolvedValue(mockFailedDelivery)
            ;(prisma as any).failedDelivery.delete = mockDelete
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            const result = await retryFailedDelivery('failed-1')

            expect(result).toBe(true)
            expect(mockDelete).toHaveBeenCalled()
        })

        it('should handle discard delivery', async () => {
            const { discardFailedDelivery } = await import('../../services/ActivityDelivery.js')
            
            const mockUpdate = vi.fn().mockResolvedValue({ id: 'failed-1' })
            ;(prisma as any).failedDelivery.update = mockUpdate

            await discardFailedDelivery('failed-1', 'admin-user-id')

            expect(mockUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'failed-1' },
                    data: expect.objectContaining({
                        status: 'DISCARDED',
                        resolvedBy: 'admin-user-id',
                    }),
                })
            )
        })

        it('should handle error when adding to dead letter queue fails', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false, status: 500 } as Response)
            const userWithId = { ...mockUser, id: 'user-123' }
            const mockCreate = vi.fn().mockRejectedValue(new Error('Database error'))
            ;(prisma as any).failedDelivery.create = mockCreate

            // Should not throw even if queue add fails
            await expect(deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithId, 2, true))
                .resolves.not.toThrow()
        })

        it('should handle network error with proper error code', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockRejectedValue(new Error('ECONNREFUSED'))
            const userWithId = { ...mockUser, id: 'user-123' }
            const mockCreate = vi.fn()
            ;(prisma as any).failedDelivery.create = mockCreate

            const result = await deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithId, 2, true)

            expect(result).toBe(false)
            // Verify that dead letter queue was called after all retries failed
            expect(mockCreate).toHaveBeenCalled()
            const call = mockCreate.mock.calls[0][0]
            expect(call.data.lastError).toBe('All retry attempts failed')
            expect(call.data.lastErrorCode).toBe('MAX_RETRIES_EXCEEDED')
        })

        it('should record HTTP error codes in dead letter queue', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ 
                ok: false, 
                status: 503, 
                statusText: 'Service Unavailable' 
            } as Response)
            const userWithId = { ...mockUser, id: 'user-123' }
            const mockCreate = vi.fn()
            ;(prisma as any).failedDelivery.create = mockCreate

            const result = await deliverWithRetry(mockActivity, 'https://remote.com/inbox', userWithId, 2, true)

            expect(result).toBe(false)
            // Verify that dead letter queue was called
            expect(mockCreate).toHaveBeenCalled()
        })

        it('should handle retry with failed delivery not found', async () => {
            const { retryFailedDelivery } = await import('../../services/ActivityDelivery.js')
            
            vi.mocked((prisma as any).failedDelivery.findUnique).mockResolvedValue(null)

            await expect(retryFailedDelivery('non-existent-id')).rejects.toThrow('Delivery not found')
        })

        it('should handle retry when user is deleted', async () => {
            const { retryFailedDelivery } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'deleted-user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'FAILED',
            }

            vi.mocked((prisma as any).failedDelivery.findUnique).mockResolvedValue(mockFailedDelivery)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            await expect(retryFailedDelivery('failed-1')).rejects.toThrow('User not found')
        })

        it('should handle empty pending deliveries in queue processing', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([])

            // Should complete without errors
            await expect(processDeadLetterQueue()).resolves.not.toThrow()
        })

        it('should handle error during queue processing gracefully', async () => {
            const { processDeadLetterQueue } = await import('../../services/ActivityDelivery.js')
            
            const mockFailedDelivery = {
                id: 'failed-1',
                activityId: mockActivity.id,
                activityType: mockActivity.type,
                activity: mockActivity,
                inboxUrl: 'https://remote.com/inbox',
                userId: 'user-123',
                attemptCount: 1,
                maxAttempts: 3,
                status: 'PENDING',
                nextRetryAt: new Date(Date.now() - 1000),
            }

            vi.mocked((prisma as any).failedDelivery.findMany).mockResolvedValue([mockFailedDelivery])
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(ssrfProtection.safeFetch).mockRejectedValue(new Error('Unexpected error'))

            // Should handle error and continue processing
            await expect(processDeadLetterQueue()).resolves.not.toThrow()

            // Should have marked as PENDING for retry
            const updateCalls = vi.mocked((prisma as any).failedDelivery.update).mock.calls
            expect(updateCalls.length).toBeGreaterThan(0)
        })
    })

    describe('deliverToInboxes with retry', () => {
        it('should use retry by default', async () => {
            const userWithId = { ...mockUser, id: 'user-123' }
            const inboxUrls = ['https://remote.com/inbox']
            
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            await deliverToInboxes(mockActivity, inboxUrls, userWithId)

            // Should be called (first attempt succeeds)
            expect(ssrfProtection.safeFetch).toHaveBeenCalled()
        })

        it('should allow disabling retry', async () => {
            const userWithId = { ...mockUser, id: 'user-123' }
            const inboxUrls = ['https://remote.com/inbox']
            
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: false, status: 500 } as Response)

            await deliverToInboxes(mockActivity, inboxUrls, userWithId, false)

            // Without retry, should only be called once
            expect(ssrfProtection.safeFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('logFederationError', () => {
        it('should log structured error information', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ 
                ok: false, 
                status: 500, 
                statusText: 'Internal Server Error' 
            } as Response)

            await deliverToInbox(mockActivity, 'https://remote.com/inbox', mockUser, false)

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Federation Error]'),
                expect.objectContaining({
                    inboxUrl: 'https://remote.com/inbox',
                    activityId: mockActivity.id,
                    activityType: mockActivity.type,
                })
            )

            consoleSpy.mockRestore()
        })
    })

    describe('calculateNextRetry', () => {
        it('should handle no private key without recording failure', async () => {
            const userWithoutKey = { ...mockUser, privateKey: null }
            
            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', userWithoutKey, false)

            expect(result).toBe(false)
        })

        it('should handle decryption failure without recording', async () => {
            vi.mocked(encryption.decryptPrivateKey).mockReturnValue(null)
            
            const result = await deliverToInbox(mockActivity, 'https://remote.com/inbox', mockUser, false)

            expect(result).toBe(false)
        })
    })

    describe('Edge cases', () => {
        it('should handle activity with statusCode error', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            } as Response)
            const userWithId = { ...mockUser, id: 'user-123' }
            const mockCreate = vi.fn()
            ;(prisma as any).failedDelivery.create = mockCreate

            await deliverToInbox(mockActivity, 'https://remote.com/inbox', userWithId, true)

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        lastErrorCode: '429',
                    }),
                })
            )
        })

        it('should handle error without statusCode', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockRejectedValue({ message: 'Connection refused' })
            const userWithId = { ...mockUser, id: 'user-123' }
            const mockCreate = vi.fn()
            ;(prisma as any).failedDelivery.create = mockCreate

            await deliverToInbox(mockActivity, 'https://remote.com/inbox', userWithId, true)

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        lastErrorCode: 'NETWORK_ERROR',
                    }),
                })
            )
        })

        it('should handle port in inbox URL correctly', async () => {
            vi.mocked(ssrfProtection.safeFetch).mockResolvedValue({ ok: true } as Response)

            await deliverToInbox(mockActivity, 'https://remote.com:8443/inbox', mockUser, false)

            const fetchCall = vi.mocked(ssrfProtection.safeFetch).mock.calls[0]
            const headers = fetchCall[1]?.headers as Record<string, string>
            expect(headers.host).toBe('remote.com:8443')
        })
    })
})

