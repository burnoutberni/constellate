import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRSVP, useUpdateEvent } from '../../hooks/queries/events'
import { api } from '../../lib/api-client'
import type { ReactNode } from 'react'
import type { EventDetail } from '../../types'

// Mock dependencies
vi.mock('../../lib/api-client', () => ({
    api: {
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}))

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: 'test-user-id',
            username: 'testuser',
            name: 'Test User',
            image: null,
        },
    }),
}))

vi.mock('../../hooks/useErrorHandler', () => ({
    useMutationErrorHandler: () => vi.fn(),
}))

describe('Event Query Hooks', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    describe('useRSVP', () => {
        it('should handle RSVP mutation without type assertions', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data in cache
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'maybe',
                        user: {
                            id: 'other-user',
                            username: 'other',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 1 },
            })

            // Trigger RSVP
            result.current.mutate({ status: 'attending' })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.post).toHaveBeenCalledWith(
                `/events/${eventId}/attend`,
                { status: 'attending' },
                undefined,
                'Failed to set attendance'
            )
        })

        it('should handle removing attendance', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.delete).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data with user's attendance
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'attending',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 1 },
            })

            // Remove attendance
            result.current.mutate(null)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.delete).toHaveBeenCalledWith(
                `/events/${eventId}/attend`,
                undefined,
                'Failed to remove attendance'
            )
        })

        it('should optimistically update attendance without type assertions', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data
            const initialData = {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'maybe',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 0 },
            }
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], initialData)

            // Change to attending
            result.current.mutate({ status: 'attending' })

            // Check optimistic update
            await waitFor(() => {
                const data = queryClient.getQueryData<EventDetail>(['events', 'detail', 'testuser', eventId])
                expect(data?.viewerStatus).toBe('attending')
                expect(data?._count.attendance).toBe(1) // Should increment
            })
        })

        it('should handle attendance array filtering without type assertions', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.delete).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up event with multiple attendees
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'attending',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                    {
                        status: 'attending',
                        user: {
                            id: 'other-user',
                            username: 'other',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 2 },
            })

            // Remove attendance
            result.current.mutate(null)

            // Check that user was filtered out correctly
            await waitFor(() => {
                const data = queryClient.getQueryData<EventDetail>(['events', 'detail', 'testuser', eventId])
                expect(data?.attendance).toHaveLength(1)
                expect(data?.attendance?.[0].user.id).toBe('other-user')
                expect(data?._count.attendance).toBe(1) // Decremented
            })
        })

        it('should handle RSVP with reminder minutes', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Trigger RSVP with reminder
            result.current.mutate({ status: 'attending', reminderMinutesBeforeStart: 30 })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.post).toHaveBeenCalledWith(
                `/events/${eventId}/attend`,
                { status: 'attending', reminderMinutesBeforeStart: 30 },
                undefined,
                'Failed to set attendance'
            )
        })

        it('should handle status transition from maybe to attending', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data with user as maybe
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'maybe',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 0 },
            })

            // Change to attending
            result.current.mutate({ status: 'attending' })

            // Check optimistic update increments count
            await waitFor(() => {
                const data = queryClient.getQueryData<EventDetail>(['events', 'detail', 'testuser', eventId])
                expect(data?.viewerStatus).toBe('attending')
                expect(data?._count.attendance).toBe(1) // Should increment from 0 to 1
            })
        })

        it('should handle status transition from attending to maybe', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data with user as attending
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'attending',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 1 },
            })

            // Change to maybe
            result.current.mutate({ status: 'maybe' })

            // Check optimistic update decrements count
            await waitFor(() => {
                const data = queryClient.getQueryData<EventDetail>(['events', 'detail', 'testuser', eventId])
                expect(data?.viewerStatus).toBe('maybe')
                expect(data?._count.attendance).toBe(0) // Should decrement from 1 to 0
            })
        })

        it('should rollback on error', async () => {
            const eventId = 'test-event-id'
            const error = new Error('Network error')
            vi.mocked(api.post).mockRejectedValue(error)

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up initial event data
            const initialData = {
                id: eventId,
                title: 'Test Event',
                attendance: [],
                _count: { attendance: 0 },
            }
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], initialData)

            // Trigger RSVP that will fail
            result.current.mutate({ status: 'attending' })

            // Wait for error
            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            // Check that data was rolled back
            const data = queryClient.getQueryData(['events', 'detail', 'testuser', eventId])
            expect(data).toEqual(initialData)
        })

        it('should remove non-attending user without decrementing count', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.delete).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up event with user as 'maybe' (not attending)
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [
                    {
                        status: 'maybe',
                        user: {
                            id: 'test-user-id',
                            username: 'testuser',
                            profileImage: null,
                            isRemote: false,
                        },
                    },
                ],
                _count: { attendance: 0 },
            })

            // Remove attendance
            result.current.mutate(null)

            // Check that count stays at 0 (not decremented)
            await waitFor(() => {
                const data = queryClient.getQueryData<EventDetail>(['events', 'detail', 'testuser', eventId])
                expect(data?.attendance).toHaveLength(0)
                expect(data?._count.attendance).toBe(0) // Should stay 0
            })
        })

        it('should update feed data with trending events', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up event detail
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [],
                _count: { attendance: 0 },
            })

            // Set up home feed with trending event
            queryClient.setQueryData(['activity', 'home'], {
                pages: [
                    {
                        items: [
                            {
                                type: 'trending_event',
                                data: {
                                    id: eventId,
                                    title: 'Test Event',
                                    attendance: [],
                                    _count: { attendance: 0 },
                                },
                            },
                        ],
                    },
                ],
            })

            // Trigger RSVP
            result.current.mutate({ status: 'attending' })

            // Check that feed was updated
            await waitFor(() => {
                const feedData = queryClient.getQueryData<{ pages: Array<{ items: Array<{ data: EventDetail }> }> }>(['activity', 'home'])
                const trendingEvent = feedData?.pages[0].items[0].data
                expect(trendingEvent?.viewerStatus).toBe('attending')
                expect(trendingEvent?._count.attendance).toBe(1)
            })
        })

        it('should update feed data with activity events', async () => {
            const eventId = 'test-event-id'
            vi.mocked(api.post).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useRSVP(eventId), { wrapper })

            // Set up event detail
            queryClient.setQueryData(['events', 'detail', 'testuser', eventId], {
                id: eventId,
                title: 'Test Event',
                attendance: [],
                _count: { attendance: 0 },
            })

            // Set up home feed with activity containing event
            queryClient.setQueryData(['activity', 'home'], {
                pages: [
                    {
                        items: [
                            {
                                type: 'activity',
                                data: {
                                    type: 'Create',
                                    event: {
                                        id: eventId,
                                        title: 'Test Event',
                                        attendance: [],
                                        _count: { attendance: 0 },
                                    },
                                },
                            },
                        ],
                    },
                ],
            })

            // Trigger RSVP
            result.current.mutate({ status: 'attending' })

            // Check that feed activity event was updated
            await waitFor(() => {
                const feedData = queryClient.getQueryData<{ pages: Array<{ items: Array<{ data: { event: EventDetail } }> }> }>(['activity', 'home'])
                const activityEvent = feedData?.pages[0].items[0].data.event
                expect(activityEvent?.viewerStatus).toBe('attending')
                expect(activityEvent?._count.attendance).toBe(1)
            })
        })
    })

    describe('useUpdateEvent', () => {
        it('should invalidate home feed after event update', async () => {
            const eventId = 'test-event-id'
            const username = 'testuser'
            vi.mocked(api.put).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useUpdateEvent(eventId, username), { wrapper })

            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

            // Trigger update
            result.current.mutate({ title: 'Updated Title' })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            // Verify it invalidates both event lists and home feed
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ['events', 'detail', username, eventId],
                })
            )
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ['events', 'list'],
                })
            )
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryKey: ['activity', 'home'],
                })
            )
        })

        it('should not duplicate event list invalidation', async () => {
            const eventId = 'test-event-id'
            const username = 'testuser'
            vi.mocked(api.put).mockResolvedValue({ success: true })

            const { result } = renderHook(() => useUpdateEvent(eventId, username), { wrapper })

            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

            result.current.mutate({ title: 'Updated Title' })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            // Count how many times events.list was invalidated
            const eventsListsCalls = invalidateSpy.mock.calls.filter((call) => {
                const queryKey = call[0]?.queryKey as string[]
                return queryKey?.[0] === 'events' && queryKey?.[1] === 'list'
            })

            // Should only be called once, not twice
            expect(eventsListsCalls).toHaveLength(1)
        })

        it('should handle update error', async () => {
            const eventId = 'test-event-id'
            const username = 'testuser'
            const error = new Error('Update failed')
            vi.mocked(api.put).mockRejectedValue(error)

            const { result } = renderHook(() => useUpdateEvent(eventId, username), { wrapper })

            // Trigger update that will fail
            result.current.mutate({ title: 'Updated Title' })

            // Wait for error
            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toBe(error)
        })
    })
})
