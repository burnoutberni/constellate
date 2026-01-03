/**
 * Frontend Real-time Hook
 * React hook for SSE connection and real-time updates
 */

import { useEffect, useRef, useState } from 'react'

import { logger } from '@/lib/logger'
import { Event } from '@/types'

interface BaseEvent {
	timestamp: string
}

interface EventCreated extends BaseEvent {
	type: 'event:created'
	data: { event: Event }
}

interface EventUpdated extends BaseEvent {
	type: 'event:updated'
	data: { event: Event }
}

interface EventDeleted extends BaseEvent {
	type: 'event:deleted'
	data: { eventId: string }
}

interface MentionReceived extends BaseEvent {
	type: 'mention:received'
	data: Record<string, unknown>
}


interface AttendanceAdded extends BaseEvent {
	type: 'attendance:added'
	data: { eventId: string; userId: string; status: string; user?: unknown }
}

interface AttendanceUpdated extends BaseEvent {
	type: 'attendance:updated'
	data: { eventId: string; userId: string; status: string; user?: unknown }
}

interface AttendanceRemoved extends BaseEvent {
	type: 'attendance:removed'
	data: { eventId: string; userId: string }
}

interface LikeAdded extends BaseEvent {
	type: 'like:added'
	data: { eventId: string; userId: string; count: number }
}

interface LikeRemoved extends BaseEvent {
	type: 'like:removed'
	data: { eventId: string; userId: string; count: number }
}

interface CommentAdded extends BaseEvent {
	type: 'comment:added'
	data: { eventId: string; comment: unknown }
}

interface CommentDeleted extends BaseEvent {
	type: 'comment:deleted'
	data: { eventId: string; commentId: string }
}

interface ProfileUpdated extends BaseEvent {
	type: 'profile:updated'
	data: { user: unknown }
}

interface FollowAdded extends BaseEvent {
	type: 'follow:added'
	data: { follower: unknown }
}

interface FollowerAdded extends BaseEvent {
	type: 'follower:added'
	data: { follower: unknown; followerCount: number }
}

interface FollowAccepted extends BaseEvent {
	type: 'follow:accepted'
	data: { isAccepted: boolean; followerCount?: number; username: string; actorUrl: string }
}

export type RealtimeEvent =
	| EventCreated
	| EventUpdated
	| EventDeleted
	| MentionReceived
	| AttendanceAdded
	| AttendanceUpdated
	| AttendanceRemoved
	| LikeAdded
	| LikeRemoved
	| CommentAdded
	| CommentDeleted
	| ProfileUpdated
	| FollowAdded
	| FollowerAdded
	| FollowAccepted

interface UseRealtimeOptions {
	userId?: string
	onEvent?: (event: RealtimeEvent) => void
	onConnect?: () => void
	onDisconnect?: () => void
}

export function useRealtime(options: UseRealtimeOptions = {}) {
	const [isConnected, setIsConnected] = useState(false)
	const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
	const eventSourceRef = useRef<EventSource | null>(null)

	// Use refs to store latest callbacks so they're always up-to-date
	const onEventRef = useRef(options.onEvent)
	const onConnectRef = useRef(options.onConnect)
	const onDisconnectRef = useRef(options.onDisconnect)

	// Update refs when callbacks change
	useEffect(() => {
		onEventRef.current = options.onEvent
		onConnectRef.current = options.onConnect
		onDisconnectRef.current = options.onDisconnect
	}, [options.onEvent, options.onConnect, options.onDisconnect])

	useEffect(() => {
		// Create SSE connection
		const url = options.userId ? `/api/stream?userId=${options.userId}` : '/api/stream'

		const eventSource = new EventSource(url, {
			withCredentials: true,
		})

		eventSourceRef.current = eventSource

		// Connection opened
		eventSource.addEventListener('connected', (_e) => {
			setIsConnected(true)
			onConnectRef.current?.()
		})

		// Heartbeat
		eventSource.addEventListener('heartbeat', () => {
			// Silent heartbeat
		})

		// Event updates
		eventSource.addEventListener('event:created', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('event:updated', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('event:deleted', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		// Attendance updates
		eventSource.addEventListener('attendance:added', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('attendance:updated', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('attendance:removed', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		// Like updates
		eventSource.addEventListener('like:added', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('like:removed', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		// Comment updates
		eventSource.addEventListener('comment:added', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('comment:deleted', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('mention:received', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		// Profile updates
		eventSource.addEventListener('profile:updated', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('follow:accepted', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		eventSource.addEventListener('follower:added', (e) => {
			const event = JSON.parse(e.data) as RealtimeEvent
			setLastEvent(event)
			onEventRef.current?.(event)
		})

		// Error handling
		eventSource.onerror = (error) => {
			logger.error('SSE error:', error)
			setIsConnected(false)
			onDisconnectRef.current?.()
		}

		// Cleanup on unmount
		return () => {
			eventSource.close()
			setIsConnected(false)
		}
	}, [options.userId])

	return {
		isConnected,
		lastEvent,
		disconnect: () => {
			eventSourceRef.current?.close()
			setIsConnected(false)
		},
	}
}
