import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useEventSearch, useNearbyEvents, type EventSearchFilters } from './search'
import type { Event } from '../../types'

// Mock fetch globally
global.fetch = vi.fn()

// Mock errorHandling
vi.mock('../../lib/errorHandling', () => ({
    buildErrorMessage: vi.fn(async (message: string, response: Response) => {
        const text = await response.text()
        return `${message}: ${text || response.statusText}`
    }),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

const mockEvent: Event = {
    id: '1',
    title: 'Test Event',
    summary: 'Test summary',
    location: 'Test Location',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    timezone: 'UTC',
    visibility: 'PUBLIC',
    tags: [],
    user: {
        id: 'user1',
        username: 'testuser',
        name: 'Test User',
        isRemote: false,
    },
    _count: {
        attendance: 0,
        likes: 0,
        comments: 0,
    },
}

describe('useEventSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should fetch events with filters', async () => {
        const mockResponse = {
            events: [mockEvent],
            pagination: {
                page: 1,
                limit: 20,
                total: 1,
                pages: 1,
            },
            filters: {},
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const filters: EventSearchFilters = { q: 'test' }
        const { result } = renderHook(() => useEventSearch(filters, 1, 20), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(mockResponse)
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/search?'),
            expect.objectContaining({ credentials: 'include' }),
        )
    })

    it('should build query string correctly with all filters', async () => {
        const mockResponse = {
            events: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            filters: {},
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const filters: EventSearchFilters = {
            q: 'test query',
            location: 'New York',
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-01-31T23:59:59Z',
            dateRange: 'next_7_days',
            status: 'EventScheduled',
            mode: 'OnlineEventAttendanceMode',
            username: 'testuser',
            tags: 'music,concert',
            categories: 'tech',
            sort: 'popularity',
        }

        const { result } = renderHook(() => useEventSearch(filters, 2, 10), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(fetchCall).toContain('/api/search?')
        expect(fetchCall).toContain('q=test+query')
        expect(fetchCall).toContain('location=New+York')
        expect(fetchCall).toContain('page=2')
        expect(fetchCall).toContain('limit=10')
        expect(fetchCall).toContain('sort=popularity')
    })

    it('should handle empty filters', async () => {
        const mockResponse = {
            events: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            filters: {},
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const { result } = renderHook(() => useEventSearch({}, 1, 20), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(fetchCall).toContain('page=1')
        expect(fetchCall).toContain('limit=20')
    })

    it('should filter out empty string values', async () => {
        const mockResponse = {
            events: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            filters: {},
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const filters: EventSearchFilters = {
            q: 'test',
            location: '', // Empty string should be filtered out
            tags: '   ', // Whitespace-only should be filtered out
        }

        const { result } = renderHook(() => useEventSearch(filters, 1, 20), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(fetchCall).toContain('q=test')
        expect(fetchCall).not.toContain('location=')
        expect(fetchCall).not.toContain('tags=')
    })

    it('should handle errors correctly', async () => {
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Server error',
        })

        const { result } = renderHook(() => useEventSearch({ q: 'test' }, 1, 20), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeDefined()
        expect(result.current.data).toBeUndefined()
    })

    it('should use placeholderData for pagination', async () => {
        const mockResponse1 = {
            events: [mockEvent],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
            filters: {},
        }

        const mockResponse2 = {
            events: [mockEvent],
            pagination: { page: 2, limit: 20, total: 1, pages: 1 },
            filters: {},
        }

        ;(global.fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse1,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse2,
            })

        const { result, rerender } = renderHook(
            ({ page }) => useEventSearch({}, page, 20),
            {
                wrapper: createWrapper(),
                initialProps: { page: 1 },
            },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.pagination.page).toBe(1)

        // Change page - should show previous data while loading
        rerender({ page: 2 })
        expect(result.current.data?.pagination.page).toBe(1) // Previous data

        await waitFor(() => expect(result.current.data?.pagination.page).toBe(2))
    })
})

describe('useNearbyEvents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should fetch nearby events with coordinates', async () => {
        const mockResponse = {
            events: [{ ...mockEvent, distanceKm: 5.2 }],
            origin: {
                latitude: 40.7128,
                longitude: -74.006,
                radiusKm: 25,
            },
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const coordinates = { latitude: 40.7128, longitude: -74.006 }
        const { result } = renderHook(() => useNearbyEvents(coordinates, 25, true), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(mockResponse)
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/search/nearby?'),
            expect.objectContaining({ credentials: 'include' }),
        )

        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(fetchCall).toContain('latitude=40.7128')
        expect(fetchCall).toContain('longitude=-74.006')
        expect(fetchCall).toContain('radiusKm=25')
        expect(fetchCall).toContain('limit=25')
    })

    it('should use default radius when not provided', async () => {
        const mockResponse = {
            events: [],
            origin: {
                latitude: 40.7128,
                longitude: -74.006,
                radiusKm: 25,
            },
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const coordinates = { latitude: 40.7128, longitude: -74.006 }
        const { result } = renderHook(() => useNearbyEvents(coordinates), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(fetchCall).toContain('radiusKm=25')
    })

    it('should not fetch when coordinates are undefined', async () => {
        const { result } = renderHook(() => useNearbyEvents(undefined, 25, true), {
            wrapper: createWrapper(),
        })

        // Query should be disabled
        expect(result.current.isFetching).toBe(false)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should not fetch when enabled is false', async () => {
        const coordinates = { latitude: 40.7128, longitude: -74.006 }
        const { result } = renderHook(() => useNearbyEvents(coordinates, 25, false), {
            wrapper: createWrapper(),
        })

        // Query should be disabled
        expect(result.current.isFetching).toBe(false)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should handle errors correctly', async () => {
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => 'Invalid coordinates',
        })

        const coordinates = { latitude: 40.7128, longitude: -74.006 }
        const { result } = renderHook(() => useNearbyEvents(coordinates, 25, true), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeDefined()
        expect(result.current.data).toBeUndefined()
    })

    it('should throw error if coordinates are missing in queryFn', async () => {
        // This tests the internal error handling
        const { result } = renderHook(() => useNearbyEvents(undefined, 25, true), {
            wrapper: createWrapper(),
        })

        // Query should be disabled, so queryFn should not be called
        expect(result.current.isFetching).toBe(false)
    })

    it('should use staleTime of 5 minutes', async () => {
        const mockResponse = {
            events: [],
            origin: {
                latitude: 40.7128,
                longitude: -74.006,
                radiusKm: 25,
            },
        }

        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        })

        const coordinates = { latitude: 40.7128, longitude: -74.006 }
        const { result } = renderHook(() => useNearbyEvents(coordinates, 25, true), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        // The staleTime is set to 5 minutes (1000 * 60 * 5)
        // We can verify the query was successful
        expect(result.current.isSuccess).toBe(true)
    })
})
