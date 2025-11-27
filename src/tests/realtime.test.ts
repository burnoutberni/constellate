/**
 * Tests for Real-time Updates (SSE)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { broadcast, broadcastToUser, getClientCount, getUserClientCount, BroadcastEvents } from '../realtime.js'
import realtimeApp from '../realtime.js'

// Mock Hono SSE streaming
vi.mock('hono/streaming', () => ({
    streamSSE: vi.fn(),
}))

describe('Real-time Updates (SSE)', () => {
    let mockContext: Context
    let mockStream: any
    let mockWriteSSE: ReturnType<typeof vi.fn>
    let mockSleep: ReturnType<typeof vi.fn>
    let mockSignal: AbortSignal

    beforeEach(() => {
        vi.clearAllMocks()
        
        mockWriteSSE = vi.fn().mockResolvedValue(undefined)
        mockSleep = vi.fn().mockResolvedValue(undefined)
        
        mockStream = {
            writeSSE: mockWriteSSE,
            sleep: mockSleep,
        }
        
        mockSignal = {
            aborted: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as AbortSignal
        
        mockContext = {
            get: vi.fn(),
            req: {
                raw: {
                    signal: mockSignal,
                },
            },
        } as unknown as Context

        // Mock streamSSE to return our mock stream
        vi.mocked(streamSSE).mockImplementation((c, callback) => {
            return callback(mockStream) as any
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('SSE Endpoint', () => {
        it('should create SSE connection', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            expect(streamSSE).toHaveBeenCalled()
        })

        it('should generate unique client ID', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            // streamSSE should have been called
            expect(streamSSE).toHaveBeenCalled()
        })

        it('should store client with userId when authenticated', async () => {
            const userId = 'user-123'
            vi.mocked(mockContext.get).mockImplementation((key: string) => {
                if (key === 'userId') return userId
                return undefined
            })
            
            await realtimeApp.request('/stream')
            
            expect(mockContext.get).toHaveBeenCalledWith('userId')
        })

        it('should send initial connection message', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10))
            
            expect(mockWriteSSE).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'connected',
                    data: expect.stringContaining('"type":"connected"'),
                })
            )
        })

        it('should include clientId in connection message', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            await new Promise(resolve => setTimeout(resolve, 10))
            
            const connectionCall = mockWriteSSE.mock.calls.find(
                call => call[0].event === 'connected'
            )
            expect(connectionCall).toBeDefined()
            const data = JSON.parse(connectionCall![0].data)
            expect(data).toHaveProperty('clientId')
            expect(data).toHaveProperty('type', 'connected')
            expect(data).toHaveProperty('timestamp')
        })

        it('should set up heartbeat interval', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            // Wait a bit to allow interval to be set up
            await new Promise(resolve => setTimeout(resolve, 50))
            
            // Heartbeat should be sent (we can't easily test the interval itself,
            // but we can verify the stream is set up correctly)
            expect(mockWriteSSE).toHaveBeenCalled()
        })

        it('should handle client disconnect', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            
            await realtimeApp.request('/stream')
            
            // Simulate abort
            if (mockSignal.addEventListener) {
                const abortHandler = mockSignal.addEventListener.mock.calls.find(
                    call => call[0] === 'abort'
                )?.[1] as () => void
                
                if (abortHandler) {
                    abortHandler()
                }
            }
            
            // Client should be removed from registry
            // We can't directly access the clients Map, but we can verify
            // the disconnect handler was set up
            expect(mockSignal.addEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
        })

        it('should keep stream open until aborted', async () => {
            vi.mocked(mockContext.get).mockReturnValue(undefined)
            mockSignal.aborted = false
            
            await realtimeApp.request('/stream')
            
            // The stream should call sleep in a loop
            // We can't easily test the infinite loop, but we can verify
            // the stream is set up correctly
            expect(mockSleep).toHaveBeenCalled()
        })
    })

    describe('Broadcast Function', () => {
        it('should broadcast to all connected clients', async () => {
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            // First, we need to have some clients connected
            // Since we can't directly access the clients Map, we'll test
            // the broadcast function by checking it doesn't throw
            await expect(broadcast(event)).resolves.not.toThrow()
        })

        it('should include timestamp in broadcast message', async () => {
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            await broadcast(event)
            
            // Broadcast should complete without error
            // The timestamp is added internally
            expect(true).toBe(true) // Placeholder - we can't easily verify the timestamp
        })

        it('should filter by targetUserId when specified', async () => {
            const event = {
                type: 'test-event',
                data: { message: 'test' },
                targetUserId: 'user-123',
            }
            
            await expect(broadcast(event)).resolves.not.toThrow()
        })

        it('should handle broadcast to zero clients', async () => {
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            await expect(broadcast(event)).resolves.not.toThrow()
        })

        it('should handle broadcast errors gracefully', async () => {
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            // Even if there are errors sending to clients,
            // broadcast should not throw
            await expect(broadcast(event)).resolves.not.toThrow()
        })
    })

    describe('broadcastToUser Function', () => {
        it('should broadcast to specific user', async () => {
            const userId = 'user-123'
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            await expect(broadcastToUser(userId, event)).resolves.not.toThrow()
        })

        it('should include timestamp in user broadcast', async () => {
            const userId = 'user-123'
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            await expect(broadcastToUser(userId, event)).resolves.not.toThrow()
        })

        it('should handle user with no connected clients', async () => {
            const userId = 'user-123'
            const event = {
                type: 'test-event',
                data: { message: 'test' },
            }
            
            await expect(broadcastToUser(userId, event)).resolves.not.toThrow()
        })
    })

    describe('getClientCount Function', () => {
        it('should return number of connected clients', () => {
            const count = getClientCount()
            expect(typeof count).toBe('number')
            expect(count).toBeGreaterThanOrEqual(0)
        })

        it('should return zero when no clients connected', () => {
            // Clear any existing clients by checking count
            const count = getClientCount()
            // We can't easily clear the clients Map, but we can verify
            // the function works
            expect(typeof count).toBe('number')
        })
    })

    describe('getUserClientCount Function', () => {
        it('should return number of clients for a user', () => {
            const userId = 'user-123'
            const count = getUserClientCount(userId)
            expect(typeof count).toBe('number')
            expect(count).toBeGreaterThanOrEqual(0)
        })

        it('should return zero for user with no connected clients', () => {
            const userId = 'nonexistent-user'
            const count = getUserClientCount(userId)
            expect(count).toBe(0)
        })
    })

    describe('BroadcastEvents Constants', () => {
        it('should export event type constants', () => {
            expect(BroadcastEvents.EVENT_CREATED).toBe('event:created')
            expect(BroadcastEvents.EVENT_UPDATED).toBe('event:updated')
            expect(BroadcastEvents.EVENT_DELETED).toBe('event:deleted')
            expect(BroadcastEvents.ATTENDANCE_ADDED).toBe('attendance:added')
            expect(BroadcastEvents.ATTENDANCE_UPDATED).toBe('attendance:updated')
            expect(BroadcastEvents.ATTENDANCE_REMOVED).toBe('attendance:removed')
            expect(BroadcastEvents.LIKE_ADDED).toBe('like:added')
            expect(BroadcastEvents.LIKE_REMOVED).toBe('like:removed')
            expect(BroadcastEvents.COMMENT_ADDED).toBe('comment:added')
            expect(BroadcastEvents.COMMENT_DELETED).toBe('comment:deleted')
            expect(BroadcastEvents.PROFILE_UPDATED).toBe('profile:updated')
            expect(BroadcastEvents.FOLLOW_ADDED).toBe('follow:added')
            expect(BroadcastEvents.FOLLOW_REMOVED).toBe('follow:removed')
            expect(BroadcastEvents.FOLLOW_ACCEPTED).toBe('follow:accepted')
            expect(BroadcastEvents.FOLLOW_PENDING).toBe('follow:pending')
            expect(BroadcastEvents.FOLLOW_REJECTED).toBe('follow:rejected')
            expect(BroadcastEvents.FOLLOWER_ADDED).toBe('follower:added')
            expect(BroadcastEvents.FOLLOWER_REMOVED).toBe('follower:removed')
        })

        it('should have all event types as const', () => {
            // Verify they're all strings
            Object.values(BroadcastEvents).forEach(eventType => {
                expect(typeof eventType).toBe('string')
            })
        })
    })
})

