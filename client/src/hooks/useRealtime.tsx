/**
 * Frontend Real-time Hook
 * React hook for SSE connection and real-time updates
 */

import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import { logger } from '@/lib/logger'
import { EventSchema } from '@/types'

// Schema Definitions
const BaseEventSchema = z.object({
	timestamp: z.string(),
})

const EventCreatedSchema = BaseEventSchema.extend({
	type: z.literal('event:created'),
	data: z.object({ event: EventSchema }),
})

const EventUpdatedSchema = BaseEventSchema.extend({
	type: z.literal('event:updated'),
	data: z.object({ event: EventSchema }),
})

const EventDeletedSchema = BaseEventSchema.extend({
	type: z.literal('event:deleted'),
	data: z.object({ eventId: z.string() }),
})

const MentionReceivedSchema = BaseEventSchema.extend({
	type: z.literal('mention:received'),
	data: z.record(z.string(), z.unknown()),
})

const AttendanceAddedSchema = BaseEventSchema.extend({
	type: z.literal('attendance:added'),
	data: z.object({
		eventId: z.string(),
		userId: z.string(),
		status: z.string(),
		user: z.unknown().optional(),
	}),
})

const AttendanceUpdatedSchema = BaseEventSchema.extend({
	type: z.literal('attendance:updated'),
	data: z.object({
		eventId: z.string(),
		userId: z.string(),
		status: z.string(),
		user: z.unknown().optional(),
	}),
})

const AttendanceRemovedSchema = BaseEventSchema.extend({
	type: z.literal('attendance:removed'),
	data: z.object({ eventId: z.string(), userId: z.string() }),
})

const LikeAddedSchema = BaseEventSchema.extend({
	type: z.literal('like:added'),
	data: z.object({ eventId: z.string(), userId: z.string(), count: z.number() }),
})

const LikeRemovedSchema = BaseEventSchema.extend({
	type: z.literal('like:removed'),
	data: z.object({ eventId: z.string(), userId: z.string(), count: z.number() }),
})

const CommentAddedSchema = BaseEventSchema.extend({
	type: z.literal('comment:added'),
	data: z.object({ eventId: z.string(), comment: z.unknown() }),
})

const CommentDeletedSchema = BaseEventSchema.extend({
	type: z.literal('comment:deleted'),
	data: z.object({ eventId: z.string(), commentId: z.string() }),
})

const ProfileUpdatedSchema = BaseEventSchema.extend({
	type: z.literal('profile:updated'),
	data: z.object({ user: z.unknown() }),
})

const FollowAddedSchema = BaseEventSchema.extend({
	type: z.literal('follow:added'),
	data: z.object({ follower: z.unknown() }),
})

const FollowerAddedSchema = BaseEventSchema.extend({
	type: z.literal('follower:added'),
	data: z.object({ follower: z.unknown(), followerCount: z.number() }),
})

const FollowAcceptedSchema = BaseEventSchema.extend({
	type: z.literal('follow:accepted'),
	data: z.object({
		isAccepted: z.boolean(),
		followerCount: z.number().optional(),
		username: z.string(),
		actorUrl: z.string(),
	}),
})

const RealtimeEventSchema = z.discriminatedUnion('type', [
	EventCreatedSchema,
	EventUpdatedSchema,
	EventDeletedSchema,
	MentionReceivedSchema,
	AttendanceAddedSchema,
	AttendanceUpdatedSchema,
	AttendanceRemovedSchema,
	LikeAddedSchema,
	LikeRemovedSchema,
	CommentAddedSchema,
	CommentDeletedSchema,
	ProfileUpdatedSchema,
	FollowAddedSchema,
	FollowerAddedSchema,
	FollowAcceptedSchema,
])

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>

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

		const handleEvent = (data: string) => {
			const result = RealtimeEventSchema.safeParse(JSON.parse(data))
			if (result.success) {
				const event = result.data
				setLastEvent(event)
				onEventRef.current?.(event)
			} else {
				logger.error('Failed to parse SSE event', { errors: result.error })
			}
		}

		// Event updates
		eventSource.addEventListener('event:created', (e) => handleEvent(e.data))
		eventSource.addEventListener('event:updated', (e) => handleEvent(e.data))
		eventSource.addEventListener('event:deleted', (e) => handleEvent(e.data))

		// Attendance updates
		eventSource.addEventListener('attendance:added', (e) => handleEvent(e.data))
		eventSource.addEventListener('attendance:updated', (e) => handleEvent(e.data))
		eventSource.addEventListener('attendance:removed', (e) => handleEvent(e.data))

		// Like updates
		eventSource.addEventListener('like:added', (e) => handleEvent(e.data))
		eventSource.addEventListener('like:removed', (e) => handleEvent(e.data))

		// Comment updates
		eventSource.addEventListener('comment:added', (e) => handleEvent(e.data))
		eventSource.addEventListener('comment:deleted', (e) => handleEvent(e.data))

		eventSource.addEventListener('mention:received', (e) => handleEvent(e.data))

		// Profile updates
		eventSource.addEventListener('profile:updated', (e) => handleEvent(e.data))

		eventSource.addEventListener('follow:accepted', (e) => handleEvent(e.data))
		eventSource.addEventListener('follower:added', (e) => handleEvent(e.data))

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
