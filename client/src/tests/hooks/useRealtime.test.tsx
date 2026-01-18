import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { useRealtime } from '../../hooks/useRealtime'

const mockAddEventListener = vi.fn()
const mockClose = vi.fn()
const mockOnerror = vi.fn()
const eventSourceInstances: Array<{
	addEventListener: typeof mockAddEventListener
	close: typeof mockClose
	onerror: typeof mockOnerror
	url: string
}> = []

function createMockEventSource() {
	const instance = {
		addEventListener: mockAddEventListener,
		close: mockClose,
		onerror: mockOnerror,
		OPEN: 1,
		CONNECTING: 0,
		CLOSED: 2,
		readyState: 0,
		url: '',
		onopen: null,
		onmessage: null,
		dispatchEvent: vi.fn(),
		removeEventListener: vi.fn(),
	}
	eventSourceInstances.push(instance as (typeof eventSourceInstances)[0])
	return instance
}

vi.mock('../../lib/logger', () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
	},
}))

describe('useRealtime', () => {
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
		mockAddEventListener.mockClear()
		mockClose.mockClear()
		mockOnerror.mockClear()
		eventSourceInstances.length = 0
	})

	afterEach(() => {
		queryClient.clear()
	})

	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)

	it('should initialize EventSource and connect', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should set isConnected to true when connected event fires', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const { result } = renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const connectHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'connected'
		)?.[1]

		expect(connectHandler).toBeDefined()

		act(() => {
			connectHandler({ type: 'connected' })
		})

		await waitFor(() => {
			expect(result.current.isConnected).toBe(true)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should call onConnect callback when connected', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onConnect = vi.fn()
		renderHook(() => useRealtime({ onConnect }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const connectHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'connected'
		)?.[1]

		act(() => {
			connectHandler({ type: 'connected' })
		})

		await waitFor(() => {
			expect(onConnect).toHaveBeenCalledTimes(1)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should call onDisconnect callback on error', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onDisconnect = vi.fn()
		renderHook(() => useRealtime({ onDisconnect }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		act(() => {
			if (eventSourceInstances.length > 0) {
				eventSourceInstances[0].onerror(new Error('SSE error'))
			}
		})

		await waitFor(() => {
			expect(onDisconnect).toHaveBeenCalledTimes(1)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should set isConnected to false on error', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const { result } = renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		act(() => {
			if (eventSourceInstances.length > 0) {
				eventSourceInstances[0].onerror(new Error('SSE error'))
			}
		})

		await waitFor(() => {
			expect(result.current.isConnected).toBe(false)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle event:created event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'event:created'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'event:created',
			data: {
				event: {
					id: 'event-1',
					title: 'New Event',
					startTime: '2024-01-15T18:00:00.000Z',
				},
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'event:created',
					data: expect.objectContaining({
						event: expect.objectContaining({ id: 'event-1' }),
					}),
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle event:updated event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'event:updated'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'event:updated',
			data: {
				event: {
					id: 'event-1',
					title: 'Updated Event',
					startTime: '2024-01-15T18:00:00.000Z',
				},
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'event:updated',
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle event:deleted event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'event:deleted'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'event:deleted',
			data: {
				eventId: 'event-1',
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'event:deleted',
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle follow:accepted event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'follow:accepted'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'follow:accepted',
			data: {
				isAccepted: true,
				followerCount: 10,
				username: 'testuser',
				actorUrl: 'https://example.com/users/testuser',
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'follow:accepted',
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle follow:pending event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'follow:pending'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'follow:pending',
			data: {
				username: 'testuser',
				actorUrl: 'https://example.com/users/testuser',
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'follow:pending',
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle follow:removed event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'follow:removed'
		)?.[1]

		expect(eventHandler).toBeDefined()

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'follow:removed',
			data: {
				username: 'testuser',
				actorUrl: 'https://example.com/users/testuser',
				isFollowing: false,
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(onEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'follow:removed',
				})
			)
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should store last event', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const { result } = renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'event:created'
		)?.[1]

		const eventData = {
			timestamp: new Date().toISOString(),
			type: 'event:created',
			data: {
				event: {
					id: 'event-1',
					title: 'New Event',
					startTime: '2024-01-15T18:00:00.000Z',
				},
			},
		}

		act(() => {
			eventHandler({ data: JSON.stringify(eventData) })
		})

		await waitFor(() => {
			expect(result.current.lastEvent).toBeDefined()
			expect(result.current.lastEvent?.type).toBe('event:created')
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should provide disconnect function', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const { result } = renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		result.current.disconnect()

		expect(mockClose).toHaveBeenCalledTimes(1)
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should clean up on unmount', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const { unmount } = renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		unmount()

		expect(mockClose).toHaveBeenCalledTimes(1)
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should use userId in SSE URL when provided', async () => {
		const eventSourceCalls: Array<{ url: string; options: unknown }> = []

		class MockEventSourceConstructor {
			constructor(url: string, options: unknown) {
				eventSourceCalls.push({ url, options })
				const instance = {
					addEventListener: mockAddEventListener,
					close: mockClose,
					onerror: mockOnerror,
					OPEN: 1,
					CONNECTING: 0,
					CLOSED: 2,
					readyState: 0,
					url,
					onopen: null,
					onmessage: null,
					dispatchEvent: vi.fn(),
					removeEventListener: vi.fn(),
				}
				eventSourceInstances.push(instance as (typeof eventSourceInstances)[0])
				Object.assign(this, instance)
			}
		}

		const originalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource =
			MockEventSourceConstructor as unknown as typeof EventSource

		renderHook(() => useRealtime({ userId: 'user-123' }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		expect(eventSourceCalls.length).toBe(1)
		expect(eventSourceCalls[0].url).toBe('/api/stream?userId=user-123')
		expect(eventSourceCalls[0].options).toEqual({ withCredentials: true })
		;(global as { EventSource: unknown }).EventSource = originalEventSource
	})

	it('should use default SSE URL when no userId', async () => {
		const eventSourceCalls: Array<{ url: string; options: unknown }> = []

		class MockEventSourceConstructor {
			constructor(url: string, options: unknown) {
				eventSourceCalls.push({ url, options })
				const instance = {
					addEventListener: mockAddEventListener,
					close: mockClose,
					onerror: mockOnerror,
					OPEN: 1,
					CONNECTING: 0,
					CLOSED: 2,
					readyState: 0,
					url,
					onopen: null,
					onmessage: null,
					dispatchEvent: vi.fn(),
					removeEventListener: vi.fn(),
				}
				eventSourceInstances.push(instance as (typeof eventSourceInstances)[0])
				Object.assign(this, instance)
			}
		}

		const originalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource =
			MockEventSourceConstructor as unknown as typeof EventSource

		renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		expect(eventSourceCalls.length).toBe(1)
		expect(eventSourceCalls[0].url).toBe('/api/stream')
		expect(eventSourceCalls[0].options).toEqual({ withCredentials: true })
		;(global as { EventSource: unknown }).EventSource = originalEventSource
	})

	it('should handle invalid JSON gracefully', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const onEvent = vi.fn()
		renderHook(() => useRealtime({ onEvent }), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		const eventHandler = mockAddEventListener.mock.calls.find(
			(call) => call[0] === 'event:created'
		)?.[1]

		act(() => {
			eventHandler({ data: 'invalid json' })
		})

		await waitFor(() => {
			expect(onEvent).not.toHaveBeenCalled()
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})

	it('should handle all event types', async () => {
		const OriginalEventSource = global.EventSource
		;(global as { EventSource: unknown }).EventSource = vi
			.fn()
			.mockImplementation(createMockEventSource)

		const eventTypes = [
			'event:created',
			'event:updated',
			'event:deleted',
			'mention:received',
			'attendance:added',
			'attendance:updated',
			'attendance:removed',
			'like:added',
			'like:removed',
			'comment:added',
			'comment:deleted',
			'profile:updated',
			'follow:added',
			'follower:added',
			'follow:accepted',
			'follow:pending',
			'follow:removed',
		]

		renderHook(() => useRealtime(), { wrapper })

		await waitFor(() => {
			expect(mockAddEventListener).toHaveBeenCalled()
		})

		eventTypes.forEach((eventType) => {
			const handler = mockAddEventListener.mock.calls.find(
				(call) => call[0] === eventType
			)?.[1]
			expect(handler).toBeDefined()
		})
		;(global as { EventSource: unknown }).EventSource = OriginalEventSource
	})
})
