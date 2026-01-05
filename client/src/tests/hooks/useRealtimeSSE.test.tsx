import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { useRealtimeSSE } from '../../hooks/useRealtimeSSE'
import { useUIStore } from '../../stores'
import type { EventDetail } from '../../types'

// Mock EventSource
const mockAddEventListener = vi.fn()
const mockClose = vi.fn()

class MockEventSource {
    constructor() { }
    addEventListener = mockAddEventListener
    close = mockClose
    // Add required EventSource properties
    withCredentials = false
    OPEN = 1
    CONNECTING = 0
    CLOSED = 2
    readyState = 0
    url = ''
    onopen = null
    onmessage = null
    onerror = null
    dispatchEvent = vi.fn()
    removeEventListener = vi.fn()
}

Object.defineProperty(global, 'EventSource', {
    writable: true,
    value: MockEventSource
})
Object.defineProperty(window, 'EventSource', {
    writable: true,
    value: MockEventSource
})

// Mock Logger
vi.mock('../../lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

describe('useRealtimeSSE', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
        // Reset spies
        mockAddEventListener.mockClear()
        mockClose.mockClear()

        useUIStore.setState({ sseConnected: false })
    })

    afterEach(() => {
        queryClient.clear()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('should initialize EventSource and handle connection', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        // Check if EventSource was instantiated?
        // We can't easily check constructor call count without a spy on the class, 
        // but we can check if instance methods were used or side effects happened.
        // Actually, we can check if addEventListener was called.

        // Wait for effect
        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        // Simulate 'connected' event
        const connectHandler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'connected'
        )?.[1]

        expect(connectHandler).toBeDefined()

        connectHandler({ type: 'connected' })

        await waitFor(() => {
            expect(useUIStore.getState().sseConnected).toBe(true)
        })
    })

    it('should handle comment:added event', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        // Setup cache with an event
        const eventId = 'ev-1'
        queryClient.setQueryData(['events', 'detail', eventId], {
            id: eventId,
            comments: [],
            _count: { comments: 0 },
        })

        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        const commentHandler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'comment:added'
        )?.[1]

        expect(commentHandler).toBeDefined()

        const newComment = {
            id: 'c1',
            content: 'New Comment',
            createdAt: new Date().toISOString(),
            author: { id: 'u1', username: 'user1' }
        }

        const payload = {
            data: {
                eventId,
                comment: newComment
            }
        }

        commentHandler({ data: JSON.stringify(payload) })

        await waitFor(() => {
            const eventData = queryClient.getQueryData(['events', 'detail', eventId]) as EventDetail
            expect(eventData.comments).toHaveLength(1)
            expect(eventData.comments[0].content).toBe('New Comment')
            expect(eventData._count?.comments).toBe(1)
        })
    })

    it('should handle like:added event', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        const eventId = 'ev-1'
        queryClient.setQueryData(['events', 'detail', eventId], {
            id: eventId,
            likes: [],
            _count: { likes: 0 },
        })

        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        const likeHandler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'like:added'
        )?.[1]

        const newLike = {
            user: { id: 'u2', username: 'liker' }
        }

        likeHandler({
            data: JSON.stringify({
                data: {
                    eventId,
                    like: newLike
                }
            })
        })

        await waitFor(() => {
            const eventData = queryClient.getQueryData(['events', 'detail', eventId]) as EventDetail
            expect(eventData.likes).toHaveLength(1)
            expect(eventData.likes[0].user.username).toBe('liker')
        })
    })

    it('should handle like:removed event', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        const eventId = 'ev-1'
        const userId = 'u2'
        queryClient.setQueryData(['events', 'detail', eventId], {
            id: eventId,
            likes: [{ user: { id: userId, username: 'liker' } }],
            _count: { likes: 1 },
        })

        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        const handler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'like:removed'
        )?.[1]

        expect(handler).toBeDefined()

        handler({
            data: JSON.stringify({
                data: {
                    eventId,
                    userId
                }
            })
        })

        await waitFor(() => {
            const eventData = queryClient.getQueryData(['events', 'detail', eventId]) as EventDetail
            expect(eventData.likes).toHaveLength(0)
            expect(eventData._count?.likes).toBe(0)
        })
    })

    it('should handle comment:deleted event', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        const eventId = 'ev-1'
        const commentId = 'c1'
        queryClient.setQueryData(['events', 'detail', eventId], {
            id: eventId,
            comments: [{ id: commentId, content: 'To delete' }],
            _count: { comments: 1 },
        })

        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        const handler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'comment:deleted'
        )?.[1]

        handler({
            data: JSON.stringify({
                data: {
                    eventId,
                    commentId
                }
            })
        })

        await waitFor(() => {
            const eventData = queryClient.getQueryData(['events', 'detail', eventId]) as EventDetail
            expect(eventData.comments).toHaveLength(0)
            expect(eventData._count?.comments).toBe(0)
        })
    })

    it('should handle event:updated event', async () => {
        renderHook(() => useRealtimeSSE(), { wrapper })

        const username = 'user1'
        const eventId = 'ev-1'
        queryClient.setQueryData(['events', 'detail', username, eventId], {
            id: eventId,
            title: 'Old Title',
            user: { username }
        })

        await waitFor(() => {
            expect(mockAddEventListener).toHaveBeenCalled()
        })

        const handler = mockAddEventListener.mock.calls.find(
            (call) => call[0] === 'event:updated'
        )?.[1]

        const updatedEvent = {
            id: eventId,
            title: 'New Title',
            user: { username }
        }

        handler({
            data: JSON.stringify({
                data: {
                    event: updatedEvent
                }
            })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData(['events', 'detail', username, eventId]) as EventDetail
            expect(data.title).toBe('New Title')
        })
    })
})
