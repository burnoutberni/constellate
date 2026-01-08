/**
 * Event Management
 * CRUD operations for events with ActivityPub federation
 */

import type { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import {
	buildCreateEventActivity,
	buildUpdateEventActivity,
	buildDeleteEventActivity,
	buildAnnounceEventActivity,
} from './services/ActivityBuilder.js'
import { deliverActivity } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit, lenientRateLimit } from './middleware/rateLimit.js'
import { prisma } from './lib/prisma.js'
import { sanitizeText } from './lib/sanitization.js'
import { normalizeTags } from './lib/tags.js'
import type { Person } from './lib/activitypubSchemas.js'
import { buildVisibilityWhere, canUserViewEvent } from './lib/eventVisibility.js'
import { handleError } from './lib/errors.js'
import { config } from './config.js'
import type { Event, EventVisibility, RecurrencePattern } from '@prisma/client'
import { RECURRENCE_PATTERNS, validateRecurrenceInput } from './lib/recurrence.js'
import {
	calculateTrendingScore,
	clampTrendingLimit,
	clampTrendingWindowDays,
	DEFAULT_TRENDING_WINDOW_DAYS,
	DAY_IN_MS,
} from './lib/trending.js'
import { isValidTimeZone, normalizeTimeZone } from './lib/timezone.js'
import { listEventRemindersForUser } from './services/reminders.js'
import { buildEventFilter } from './lib/eventQueries.js'

declare module 'hono' {
	interface ContextVariableMap {
		userId: string
	}
}
const app = new Hono()

const commentUserSelect = {
	id: true,
	username: true,
	name: true,
	profileImage: true,
	displayColor: true,
	isRemote: true,
} as const

const commentMentionInclude = {
	mentions: {
		include: {
			mentionedUser: {
				select: commentUserSelect,
			},
		},
	},
} as const

const eventUserSummarySelect = {
	id: true,
	username: true,
	name: true,
	displayColor: true,
	profileImage: true,
	isRemote: true,
} as const

export const eventBaseInclude = {
	user: {
		select: eventUserSummarySelect,
	},
	tags: true,
	sharedEvent: {
		select: {
			id: true,
		},
	},
	_count: {
		select: {
			attendance: true,
			likes: true,
			comments: true,
		},
	},
} as const

const authenticatedEventExtras = {
	attendance: {
		select: {
			status: true,
			userId: true,
			user: {
				select: eventUserSummarySelect,
			},
		},
	},
	likes: {
		select: {
			userId: true,
		},
	},
} as const

export function buildEventInclude(userId?: string) {
	if (userId) {
		return {
			...eventBaseInclude,
			...authenticatedEventExtras,
		}
	}
	return eventBaseInclude
}

export async function hydrateEventUsers<T extends { user: unknown; attributedTo: string | null }>(
	events: T[]
): Promise<T[]> {
	return Promise.all(
		events.map(async (event) => {
			if (!event.user && event.attributedTo) {
				const remoteUser = await prisma.user.findFirst({
					where: { externalActorUrl: event.attributedTo },
					select: eventUserSummarySelect,
				})
				if (remoteUser) {
					return { ...event, user: remoteUser }
				}
			}
			return event
		})
	)
}

// Transform sharedEvent to originalEventId for client compatibility
// Also derives viewerStatus from attendance list if available
function transformEventForClient<
	T extends {
		sharedEvent?: { id: string } | null
		attendance?: Array<{ userId: string; status: string }>
	},
>(
	event: T,
	viewerId?: string
): Omit<T, 'sharedEvent'> & { originalEventId?: string | null; viewerStatus?: string | null } {
	const { sharedEvent, ...rest } = event

	// Derive viewerStatus from attendance if viewerId is provided
	let viewerStatus: string | null = null
	if (viewerId && event.attendance) {
		const myAttendance = event.attendance.find((a) => a.userId === viewerId)
		if (myAttendance) {
			viewerStatus = myAttendance.status
		}
	}

	return {
		...rest,
		originalEventId: sharedEvent?.id ?? null,
		viewerStatus: (event as T & { viewerStatus?: string | null }).viewerStatus ?? viewerStatus, // Preserve existing if present
	}
}

export function transformEventsForClient<
	T extends {
		sharedEvent?: { id: string } | null
		attendance?: Array<{ userId: string; status: string }>
	},
>(
	events: T[],
	viewerId?: string
): Array<
	Omit<T, 'sharedEvent'> & { originalEventId?: string | null; viewerStatus?: string | null }
> {
	return events.map((e) => transformEventForClient(e, viewerId))
}

function buildCountMap(records: Array<{ eventId: string }>) {
	return records.reduce<Record<string, number>>((acc, record) => {
		acc[record.eventId] = (acc[record.eventId] ?? 0) + 1
		return acc
	}, {})
}

export function normalizeRecipients(value?: string | string[]): string[] {
	if (!value) {
		return []
	}
	if (Array.isArray(value)) {
		return value
	}
	return [value]
}

export function buildAddressingFromActivity(activity: {
	to?: string | string[]
	cc?: string | string[]
}) {
	const toArray = normalizeRecipients(activity.to)
	const ccArray = normalizeRecipients(activity.cc)

	return {
		to: toArray,
		cc: ccArray,
		bcc: [] as string[],
	}
}

export function getBroadcastTarget(
	visibility: Event['visibility'] | null | undefined,
	ownerId: string
) {
	if (!visibility || visibility === 'PUBLIC' || visibility === 'FOLLOWERS') {
		return undefined
	}
	return ownerId
}

const RecurrencePatternEnum = z.enum(RECURRENCE_PATTERNS)

// Event validation schema
const VisibilitySchema = z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED'])

const TimezoneSchema = z.string().refine(isValidTimeZone, 'Invalid timezone')

// Base event schema without coordinate validation (used for both create and update)
const BaseEventSchema = z.object({
	title: z.string().min(1).max(200),
	summary: z.string().optional(),
	location: z.string().optional(),
	locationLatitude: z.number().min(-90).max(90).nullish(),
	locationLongitude: z.number().min(-180).max(180).nullish(),
	headerImage: z.url({ message: 'Invalid URL' }).optional(),
	url: z.url({ message: 'Invalid URL' }).optional(),
	startTime: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		}),
	endTime: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	duration: z.string().optional(),
	eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
	eventAttendanceMode: z
		.enum([
			'OfflineEventAttendanceMode',
			'OnlineEventAttendanceMode',
			'MixedEventAttendanceMode',
		])
		.optional(),
	maximumAttendeeCapacity: z.number().int().positive().optional(),
	remainingAttendeeCapacity: z.number().int().nonnegative().optional(),
	updatedAt: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.optional(),
	visibility: VisibilitySchema.optional(),
	recurrencePattern: RecurrencePatternEnum.optional().nullable(),
	recurrenceEndDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
			message: 'Invalid datetime string',
		})
		.nullish(),
	tags: z.array(z.string().min(1).max(50)).optional(), // Array of tag strings
	timezone: TimezoneSchema.optional(),
})

// Event schema for creates - requires both coordinates if either is provided
const EventSchema = BaseEventSchema.refine(
	(data) => {
		const hasLat = data.locationLatitude !== undefined && data.locationLatitude !== null
		const hasLon = data.locationLongitude !== undefined && data.locationLongitude !== null
		// Either both must be provided or both must be omitted
		return (hasLat && hasLon) || (!hasLat && !hasLon)
	},
	{
		message: 'Latitude and longitude must both be provided',
		path: ['locationLatitude'],
	}
)

// Helper function to process and normalize tags for event creation
function processTagsForCreation(tags: unknown): Array<{ tag: string }> | undefined {
	if (!tags || !Array.isArray(tags) || tags.length === 0) {
		return undefined
	}

	try {
		const normalizedTags = normalizeTags(tags)
		if (normalizedTags && normalizedTags.length > 0) {
			return normalizedTags.map((tag) => ({ tag }))
		}
	} catch (error) {
		console.error('Error normalizing tags:', error)
		throw error
	}

	return undefined
}

// Helper function to build event creation data
function buildEventCreationData(
	validatedData: z.infer<typeof EventSchema>,
	userId: string,
	actorUrl: string,
	visibility: EventVisibility,
	startTime: Date,
	endTime: Date | null,
	recurrencePattern: RecurrencePattern | null,
	recurrenceEndDate: Date | null,
	timezone: string,
	tagsToCreate: Array<{ tag: string }> | undefined
) {
	return {
		title: sanitizeText(validatedData.title),
		summary: validatedData.summary ? sanitizeText(validatedData.summary) : null,
		location: validatedData.location ? sanitizeText(validatedData.location) : null,
		locationLatitude: validatedData.locationLatitude ?? null,
		locationLongitude: validatedData.locationLongitude ?? null,
		headerImage: validatedData.headerImage || null,
		url: validatedData.url || null,
		startTime,
		endTime,
		duration: validatedData.duration || null,
		eventStatus: validatedData.eventStatus || null,
		eventAttendanceMode: validatedData.eventAttendanceMode || null,
		maximumAttendeeCapacity: validatedData.maximumAttendeeCapacity || null,
		userId,
		attributedTo: actorUrl,
		visibility,
		recurrencePattern,
		recurrenceEndDate,
		timezone,
		...(tagsToCreate && tagsToCreate.length > 0
			? {
					tags: {
						create: tagsToCreate,
					},
				}
			: {}),
	}
}

// Helper function to broadcast event creation
async function broadcastEventCreation(
	event: Event & { user: unknown; tags: unknown[] },
	user: {
		id: string
		username: string
		name: string | null
		displayColor: string | null
		profileImage: string | null
	},
	userId: string
) {
	const { broadcast, BroadcastEvents } = await import('./realtime.js')
	const broadcastPayload = {
		event: {
			id: event.id,
			title: event.title,
			summary: event.summary,
			location: event.location,
			locationLatitude: (event as { locationLatitude: number | null }).locationLatitude,
			locationLongitude: (event as { locationLongitude: number | null }).locationLongitude,
			url: event.url,
			startTime: (event as { startTime: Date }).startTime.toISOString(),
			endTime: (event as { endTime: Date | null }).endTime?.toISOString(),
			eventStatus: (event as { eventStatus: string | null }).eventStatus,
			visibility: (event as { visibility: string | null }).visibility,
			recurrencePattern: (event as { recurrencePattern: string | null }).recurrencePattern,
			recurrenceEndDate: (
				event as { recurrenceEndDate: Date | null }
			).recurrenceEndDate?.toISOString(),
			timezone: (event as { timezone: string | null }).timezone,
			user: {
				id: user.id,
				username: user.username,
				name: user.name,
				displayColor: user.displayColor,
				profileImage: user.profileImage,
			},
			_count: {
				attendance: 0,
				likes: 0,
				comments: 0,
			},
		},
	}
	const broadcastTarget = getBroadcastTarget(
		(event as { visibility: EventVisibility | null }).visibility,
		userId
	)
	await broadcast({
		type: BroadcastEvents.EVENT_CREATED,
		data: broadcastPayload,
		...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
	})
}

// Event schema for updates - allows partial fields, validates coordinate pairs correctly
const UpdateEventSchema = z
	.object({
		title: z.string().min(1).max(200).optional(),
		summary: z.string().optional(),
		description: z.string().optional(),
		location: z.string().optional(),
		locationLatitude: z.number().min(-90).max(90).nullish(),
		locationLongitude: z.number().min(-180).max(180).nullish(),
		headerImage: z.url({ message: 'Invalid URL' }).optional(),
		url: z.url({ message: 'Invalid URL' }).optional(),
		startTime: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
				message: 'Invalid datetime string',
			})
			.optional(),
		endTime: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
				message: 'Invalid datetime string',
			})
			.optional(),
		duration: z.string().optional(),
		eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
		eventAttendanceMode: z
			.enum([
				'OfflineEventAttendanceMode',
				'OnlineEventAttendanceMode',
				'MixedEventAttendanceMode',
			])
			.optional(),
		maximumAttendeeCapacity: z.number().int().positive().optional(),
		remainingAttendeeCapacity: z.number().int().nonnegative().optional(),
		updatedAt: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
				message: 'Invalid datetime string',
			})
			.optional(),
		visibility: VisibilitySchema.optional(),
		recurrencePattern: RecurrencePatternEnum.nullish(),
		recurrenceEndDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
				message: 'Invalid datetime string',
			})
			.nullish(),
		tags: z.array(z.string().min(1).max(50)).optional(),
		timezone: TimezoneSchema.optional(),
	})
	.refine(
		(data) => {
			// Check if coordinates are explicitly provided (including null to clear them)
			const hasLat = data.locationLatitude !== undefined
			const hasLon = data.locationLongitude !== undefined
			// If neither is provided, that's fine (no change to coordinates)
			if (!hasLat && !hasLon) {
				return true
			}
			// If one is provided, both must be provided (both can be null to clear)
			// This ensures coordinate pairs are always complete
			return (hasLat && hasLon) || (!hasLat && !hasLon)
		},
		{
			message: 'Latitude and longitude must both be provided or both omitted',
			path: ['locationLatitude'],
		}
	)

// Create event
app.post('/', moderateRateLimit, async (c) => {
	try {
		// Get userId from context (set by authMiddleware)
		const userId = c.get('userId') as string | undefined
		if (!userId) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		const body: unknown = await c.req.json()
		const validatedData = EventSchema.parse(body)
		const { visibility: requestedVisibility } = validatedData
		const visibility: EventVisibility = (requestedVisibility ?? 'PUBLIC') as EventVisibility

		const startTime = new Date(validatedData.startTime)
		const endTime = validatedData.endTime ? new Date(validatedData.endTime) : null
		const recurrencePattern: RecurrencePattern | null = validatedData.recurrencePattern ?? null
		const recurrenceEndDate = validatedData.recurrenceEndDate
			? new Date(validatedData.recurrenceEndDate)
			: null

		validateRecurrenceInput(startTime, recurrencePattern, recurrenceEndDate)

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				name: true,
				displayColor: true,
				profileImage: true,
				externalActorUrl: true,
				isRemote: true,
				timezone: true,
			},
		})

		if (!user || user.isRemote) {
			return c.json({ error: 'User not found or is remote' }, 404)
		}

		const timezone = normalizeTimeZone(validatedData.timezone ?? user.timezone)
		const baseUrl = getBaseUrl()
		const actorUrl = `${baseUrl}/users/${user.username}`

		// Extract and process tags from validated data
		const { tags } = validatedData
		let tagsToCreate: Array<{ tag: string }> | undefined
		try {
			tagsToCreate = processTagsForCreation(tags)
		} catch (error) {
			// Return validation error when tag normalization fails
			return c.json(
				{
					error: 'VALIDATION_ERROR',
					message: 'Failed to process tags: ensure tags are valid strings',
					details: config.isDevelopment ? { originalError: String(error) } : undefined,
				},
				400
			)
		}

		// Create event with sanitized input
		const event = await prisma.event.create({
			data: buildEventCreationData(
				validatedData,
				userId,
				actorUrl,
				visibility,
				startTime,
				endTime,
				recurrencePattern,
				recurrenceEndDate,
				timezone,
				tagsToCreate
			),
			include: {
				user: true,
				tags: true,
			},
		})

		// Automatically add creator as attending
		await prisma.eventAttendance.create({
			data: {
				eventId: event.id,
				userId,
				status: 'attending',
			},
		})

		// Build and deliver Create activity
		const activity = buildCreateEventActivity(event, userId)

		const addressing = buildAddressingFromActivity(activity)
		await deliverActivity(activity, addressing, userId)

		// Broadcast real-time update
		await broadcastEventCreation(
			event as Event & { user: typeof user; tags: unknown[] },
			user,
			userId
		)

		return c.json(event, 201)
	} catch (error) {
		console.error('Error creating event:', error)
		return handleError(error, c)
	}
})

// List events
app.get('/', async (c) => {
	try {
		// Optional authentication - get userId from context if available
		const userId = c.get('userId') as string | undefined
		const page = parseInt(c.req.query('page') || '1')
		const limit = parseInt(c.req.query('limit') || '20')
		const skip = (page - 1) * limit

		const rangeStartParam = c.req.query('rangeStart')
		const rangeEndParam = c.req.query('rangeEnd')
		let rangeStartDate: Date | undefined
		let rangeEndDate: Date | undefined

		if (rangeStartParam) {
			const parsed = new Date(rangeStartParam)
			if (!Number.isNaN(parsed.getTime())) {
				rangeStartDate = parsed
			}
		}

		if (rangeEndParam) {
			const parsed = new Date(rangeEndParam)
			if (!Number.isNaN(parsed.getTime())) {
				rangeEndDate = parsed
			}
		}

		// Handle "onlyMine" filter
		const onlyMine = c.req.query('onlyMine') === 'true'

		let rangeFilter: Prisma.EventWhereInput | undefined
		if (rangeStartDate && rangeEndDate) {
			rangeFilter = {
				OR: [
					{
						startTime: {
							gte: rangeStartDate,
							lte: rangeEndDate,
						},
					},
					{
						AND: [
							{ recurrencePattern: { not: null } },
							{ startTime: { lte: rangeEndDate } },
							{ recurrenceEndDate: { gte: rangeStartDate } },
						],
					},
				],
			}
		}

		let followedActorUrls: string[] = []
		if (userId) {
			const following = await prisma.following.findMany({
				where: { userId, accepted: true },
				select: { actorUrl: true },
			})
			followedActorUrls = following.map((f) => f.actorUrl)
		}

		// Build visibility filter
		const visibilityWhere = userId
			? buildVisibilityWhere({ userId, followedActorUrls })
			: { visibility: 'PUBLIC' as const }

		// Apply "onlyMine" filter if requested
		const onlyMineFilter = buildEventFilter({ onlyMine }, userId)

		// Combine filters
		const filters: Prisma.EventWhereInput[] = [
			visibilityWhere,
			{ sharedEventId: null },
			onlyMineFilter, // Add this
		]

		if (rangeFilter) {
			filters.push(rangeFilter)
		} else if (!rangeStartDate && !rangeEndDate) {
			// Default to upcoming events if no range is specified
			filters.push({
				OR: [
					{ startTime: { gte: new Date() } },
					{
						AND: [
							{ recurrencePattern: { not: null } },
							{ recurrenceEndDate: { gte: new Date() } },
						],
					},
				],
			})
		}
		const where = filters.length === 1 ? filters[0] : { AND: filters }

		const events = await prisma.event.findMany({
			where,
			include: buildEventInclude(userId),
			orderBy: { startTime: 'asc' },
			skip,
			take: limit,
		})

		const eventsWithUsers = await hydrateEventUsers(events)
		const eventsForClient = transformEventsForClient(eventsWithUsers, userId)

		const total = await prisma.event.count({ where })

		return c.json({
			events: eventsForClient,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		})
	} catch (error) {
		console.error('Error listing events:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

app.get('/trending', lenientRateLimit, async (c) => {
	try {
		const userId = c.get('userId') as string | undefined
		const limitParam = Number.parseInt(c.req.query('limit') ?? '')
		const windowParam = Number.parseInt(c.req.query('windowDays') ?? '')

		const limit = clampTrendingLimit(limitParam)
		const windowDays = clampTrendingWindowDays(windowParam || DEFAULT_TRENDING_WINDOW_DAYS)

		const now = new Date()
		const windowStart = new Date(now.getTime() - windowDays * DAY_IN_MS)

		let followedActorUrls: string[] = []
		if (userId) {
			const following = await prisma.following.findMany({
				where: { userId, accepted: true },
				select: { actorUrl: true },
			})
			followedActorUrls = following.map((f) => f.actorUrl)
		}

		const visibilityWhere = userId
			? buildVisibilityWhere({ userId, followedActorUrls })
			: { visibility: 'PUBLIC' as const }

		const filters: Prisma.EventWhereInput[] = [
			visibilityWhere,
			{ sharedEventId: null },
			{
				OR: [{ startTime: { gte: windowStart } }, { updatedAt: { gte: windowStart } }],
			},
		]
		const where = filters.length === 1 ? filters[0] : { AND: filters }

		const candidateLimit = Math.min(limit * 3, 100)
		const candidateEvents = await prisma.event.findMany({
			where,
			include: buildEventInclude(userId),
			orderBy: [{ updatedAt: 'desc' }, { startTime: 'asc' }],
			take: candidateLimit,
		})

		const hydratedEvents = await hydrateEventUsers(candidateEvents)
		const eventIds = hydratedEvents.map((event) => event.id)

		if (eventIds.length === 0) {
			return c.json({
				events: [],
				windowDays,
				generatedAt: now.toISOString(),
			})
		}

		const [likes, comments, attendance] = await Promise.all([
			prisma.eventLike.findMany({
				where: {
					eventId: { in: eventIds },
					createdAt: { gte: windowStart },
				},
				select: { eventId: true },
			}),
			prisma.comment.findMany({
				where: {
					eventId: { in: eventIds },
					createdAt: { gte: windowStart },
				},
				select: { eventId: true },
			}),
			prisma.eventAttendance.findMany({
				where: {
					eventId: { in: eventIds },
					createdAt: { gte: windowStart },
				},
				select: { eventId: true },
			}),
		])

		const likeCountMap = buildCountMap(likes)
		const commentCountMap = buildCountMap(comments)
		const attendanceCountMap = buildCountMap(attendance)

		const scoredEvents = hydratedEvents
			.map((event) => {
				const metrics = {
					likes: likeCountMap[event.id] ?? 0,
					comments: commentCountMap[event.id] ?? 0,
					attendance: attendanceCountMap[event.id] ?? 0,
				}
				const engagementTotal = metrics.likes + metrics.comments + metrics.attendance
				const score = calculateTrendingScore({
					metrics,
					event,
					windowDays,
					now,
				})
				return {
					event,
					metrics,
					engagementTotal,
					score,
				}
			})
			.filter(({ engagementTotal, score }) => engagementTotal > 0 && score > 0)
			.sort((a, b) => {
				if (b.score !== a.score) {
					return b.score - a.score
				}
				if (b.metrics.likes !== a.metrics.likes) {
					return b.metrics.likes - a.metrics.likes
				}
				return a.event.startTime.getTime() - b.event.startTime.getTime()
			})
			.slice(0, limit)

		const events = scoredEvents.map(({ event, metrics, score }, index) => ({
			...transformEventForClient(event),
			trendingScore: score,
			trendingRank: index + 1,
			trendingMetrics: metrics,
		}))

		return c.json({
			events,
			windowDays,
			generatedAt: now.toISOString(),
		})
	} catch (error) {
		console.error('Error fetching trending events:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Helper function to get event with full includes
function getEventFullInclude() {
	return {
		user: {
			select: {
				id: true,
				username: true,
				name: true,
				displayColor: true,
				profileImage: true,
				externalActorUrl: true,
				isRemote: true,
			},
		},
		tags: true,
		sharedEvent: {
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						displayColor: true,
						profileImage: true,
						externalActorUrl: true,
						isRemote: true,
					},
				},
			},
		},
		attendance: {
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						profileImage: true,
						isRemote: true,
					},
				},
			},
		},
		likes: {
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						profileImage: true,
						isRemote: true,
					},
				},
			},
		},
		comments: {
			include: {
				author: {
					select: commentUserSelect,
				},
				...commentMentionInclude,
				replies: {
					include: {
						author: {
							select: commentUserSelect,
						},
						...commentMentionInclude,
					},
				},
			},
			where: {
				inReplyToId: null,
			},
			orderBy: { createdAt: 'desc' as const },
		},
		_count: {
			select: {
				attendance: true,
				likes: true,
				comments: true,
			},
		},
	}
}

type EventWithFullInclude = Prisma.EventGetPayload<{
	include: ReturnType<typeof getEventFullInclude>
}>

type EventUserSummary = Prisma.UserGetPayload<{
	select: {
		id: true
		username: true
		name: true
		displayColor: true
		profileImage: true
		externalActorUrl: true
		isRemote: true
	}
}>

type SerializedReminderList = Awaited<ReturnType<typeof listEventRemindersForUser>>

// Helper function to find or cache remote user
async function findOrCacheRemoteUser(actorUrl: string | undefined) {
	if (!actorUrl) return null

	let user = await prisma.user.findFirst({
		where: { externalActorUrl: actorUrl },
	})

	if (!user) {
		const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
		const actor = await fetchActor(actorUrl)
		if (actor) {
			user = await cacheRemoteUser(actor as unknown as Person)
		}
	}

	return user
}

// Helper function to cache attendance from remote event reply
async function cacheAttendanceFromReply(replyObj: Record<string, unknown>, eventId: string) {
	const replyType = replyObj.type
	if (replyType !== 'Accept' && replyType !== 'TentativeAccept' && replyType !== 'Reject') {
		return
	}

	const actorUrl = replyObj.actor as string | undefined
	const attendeeUser = await findOrCacheRemoteUser(actorUrl)

	if (!attendeeUser) return

	let status = 'attending'
	if (replyType === 'TentativeAccept') status = 'maybe'
	if (replyType === 'Reject') status = 'not_attending'

	await prisma.eventAttendance.upsert({
		where: {
			eventId_userId: {
				userId: attendeeUser.id,
				eventId,
			},
		},
		update: { status },
		create: {
			userId: attendeeUser.id,
			eventId,
			status,
		},
	})
}

// Helper function to cache comment from remote event reply
async function cacheCommentFromReply(replyObj: Record<string, unknown>, eventId: string) {
	const replyType = replyObj.type
	if (replyType !== 'Note') return

	const actorUrl = replyObj.attributedTo as string | undefined
	const content = replyObj.content as string | undefined

	if (!actorUrl || !content || !replyObj.id) return

	const authorUser = await findOrCacheRemoteUser(actorUrl)
	if (!authorUser) return

	await prisma.comment.upsert({
		where: { externalId: replyObj.id as string },
		update: { content },
		create: {
			externalId: replyObj.id as string,
			content,
			eventId,
			authorId: authorUser.id,
		},
	})
}

// Helper function to cache likes from remote event
async function cacheLikesFromRemoteEvent(
	likes: { items?: unknown[] } | undefined,
	eventId: string
) {
	if (!likes?.items) return

	for (const like of likes.items) {
		const likeObj: unknown = like
		let actorUrl: string | undefined

		if (typeof likeObj === 'object' && likeObj !== null && 'actor' in likeObj) {
			actorUrl = (likeObj as { actor: unknown }).actor as string
		} else if (typeof likeObj === 'string') {
			actorUrl = likeObj
		}

		if (!actorUrl) continue

		const likerUser = await findOrCacheRemoteUser(actorUrl)
		if (!likerUser) continue

		await prisma.eventLike.upsert({
			where: {
				eventId_userId: {
					userId: likerUser.id,
					eventId,
				},
			},
			update: {},
			create: {
				userId: likerUser.id,
				eventId,
			},
		})
	}
}

// Helper function to cache remote event data
async function cacheRemoteEventData(eventId: string, externalId: string) {
	try {
		const remoteResponse = await fetch(externalId, {
			headers: {
				Accept: 'application/activity+json',
			},
		})

		if (!remoteResponse.ok) return

		const remoteEvent = (await remoteResponse.json()) as Record<string, unknown>

		// Cache attendance and comments from replies
		if (remoteEvent && typeof remoteEvent === 'object' && 'replies' in remoteEvent) {
			const replies = remoteEvent.replies as { items?: unknown[] } | undefined
			if (replies?.items) {
				for (const reply of replies.items) {
					const replyObj = reply as Record<string, unknown>
					await cacheAttendanceFromReply(replyObj, eventId)
					await cacheCommentFromReply(replyObj, eventId)
				}
			}
		}

		// Cache likes
		const likes = remoteEvent.likes as { items?: unknown[] } | undefined
		await cacheLikesFromRemoteEvent(likes, eventId)

		// Update event URL if present
		const remoteUrl = remoteEvent.url as string | undefined
		if (remoteUrl) {
			const existingEvent = await prisma.event.findUnique({
				where: { id: eventId },
				select: { url: true },
			})
			if (remoteUrl !== existingEvent?.url) {
				await prisma.event.update({
					where: { id: eventId },
					data: { url: remoteUrl },
				})
			}
		}

		console.log(`✅ Cached attendance and likes for remote event ${eventId}`)
	} catch (error) {
		console.error('Error fetching remote event details:', error)
		// Continue with cached data
	}
}

async function processRemoteEvent(
	event: EventWithFullInclude,
	user: EventUserSummary,
	responseExtras: { userHasShared: boolean; viewerReminders: SerializedReminderList }
) {
	if (event.externalId) {
		await cacheRemoteEventData(event.id, event.externalId)
		const updatedEvent = await prisma.event.findFirst({
			where: { id: event.id },
			include: getEventFullInclude(),
		})
		if (updatedEvent) {
			return { ...updatedEvent, user: updatedEvent.user || user, ...responseExtras }
		}
	}

	return { ...event, user: event.user || user, ...responseExtras }
}

// Get event by username and eventId (Mastodon-style URL)
app.get('/by-user/:username/:eventId', async (c) => {
	try {
		const { username, eventId } = c.req.param()
		const viewerId = c.get('userId') as string | undefined

		const isRemote = username.includes('@')
		const user = await prisma.user.findFirst({
			where: { username, isRemote },
			select: {
				id: true,
				username: true,
				name: true,
				displayColor: true,
				profileImage: true,
				externalActorUrl: true,
				isRemote: true,
			},
		})
		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		const event = await prisma.event.findFirst({
			where: {
				id: eventId,
				...(isRemote
					? { attributedTo: user.externalActorUrl || undefined }
					: { userId: user.id }),
			},
			include: getEventFullInclude(),
		})

		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}

		if (!(await canUserViewEvent(event, viewerId))) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		const originalEvent = event.sharedEvent ?? event
		const userHasShared =
			!!viewerId &&
			!!(await prisma.event.findFirst({
				where: { userId: viewerId, sharedEventId: originalEvent.id },
				select: { id: true },
			}))

		const viewerReminders = viewerId ? await listEventRemindersForUser(event.id, viewerId) : []
		const responseExtras = { userHasShared, viewerReminders }

		if (isRemote) {
			const result = await processRemoteEvent(event, user, responseExtras)
			return c.json(result)
		}

		return c.json({ ...event, ...responseExtras })
	} catch (error) {
		console.error('Error getting event by username:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Get single event
app.get('/:id', async (c) => {
	try {
		const { id } = c.req.param()

		const event = await prisma.event.findUnique({
			where: { id },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						displayColor: true,
						profileImage: true,
						externalActorUrl: true,
					},
				},
				tags: true,
				sharedEvent: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								name: true,
								displayColor: true,
								profileImage: true,
								externalActorUrl: true,
								isRemote: true,
							},
						},
					},
				},
				attendance: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								name: true,
								profileImage: true,
							},
						},
					},
				},
				likes: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								name: true,
								profileImage: true,
							},
						},
					},
				},
				comments: {
					include: {
						author: {
							select: commentUserSelect,
						},
						...commentMentionInclude,
						replies: {
							include: {
								author: {
									select: commentUserSelect,
								},
								...commentMentionInclude,
							},
						},
					},
					where: {
						inReplyToId: null, // Top-level comments only
					},
					orderBy: { createdAt: 'desc' as const },
				},
				_count: {
					select: {
						attendance: true,
						likes: true,
						comments: true,
					},
				},
			},
		})

		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}

		const viewerId = c.get('userId') as string | undefined
		const canView = await canUserViewEvent(event, viewerId)
		if (!canView) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		// Check if viewer has shared the original event
		const originalEvent = event.sharedEvent ?? event
		let userHasShared = false
		if (viewerId) {
			const existingShare = await prisma.event.findFirst({
				where: {
					userId: viewerId,
					sharedEventId: originalEvent.id,
				},
				select: { id: true },
			})
			userHasShared = !!existingShare
		}

		const viewerReminders = viewerId ? await listEventRemindersForUser(event.id, viewerId) : []

		return c.json({ ...event, userHasShared, viewerReminders })
	} catch (error) {
		console.error('Error getting event:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Share (repost) event
app.post('/:id/share', moderateRateLimit, async (c) => {
	try {
		const { id } = c.req.param()
		const userId = requireAuth(c)

		const shareUser = await prisma.user.findUnique({
			where: { id: userId },
		})

		if (!shareUser || shareUser.isRemote) {
			return c.json({ error: 'User not found or is remote' }, 404)
		}

		const includeShareRelations = {
			user: {
				select: {
					id: true,
					username: true,
					name: true,
					displayColor: true,
					profileImage: true,
					externalActorUrl: true,
					isRemote: true,
				},
			},
			sharedEvent: {
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
							externalActorUrl: true,
							isRemote: true,
						},
					},
				},
			},
		}

		const event = await prisma.event.findUnique({
			where: { id },
			include: includeShareRelations,
		})

		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}

		const originalEvent = event.sharedEvent ?? event

		// Check if user can view the original event (this already enforces visibility rules)
		const canViewOriginal = await canUserViewEvent(originalEvent, userId)
		if (!canViewOriginal) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		// Explicitly check visibility for sharing - only PUBLIC events can be shared
		// This is a business rule separate from viewing permissions
		if (originalEvent.visibility !== 'PUBLIC') {
			return c.json({ error: 'Only public events can be shared' }, 403 as const)
		}

		const duplicateShare = await prisma.event.findFirst({
			where: {
				userId,
				sharedEventId: originalEvent.id,
			},
			include: includeShareRelations,
		})

		if (duplicateShare) {
			return c.json({ share: duplicateShare, alreadyShared: true })
		}

		const baseUrl = getBaseUrl()
		let originalActorUrl = originalEvent.attributedTo
		if (!originalActorUrl && originalEvent.user) {
			originalActorUrl = `${baseUrl}/users/${originalEvent.user.username}`
		}

		const originalEventUrl = originalEvent.externalId || `${baseUrl}/events/${originalEvent.id}`

		const share = await prisma.event.create({
			data: {
				title: originalEvent.title,
				summary: originalEvent.summary,
				location: originalEvent.location,
				locationLatitude: originalEvent.locationLatitude,
				locationLongitude: originalEvent.locationLongitude,
				headerImage: originalEvent.headerImage,
				url: originalEvent.url,
				startTime: originalEvent.startTime,
				endTime: originalEvent.endTime,
				duration: originalEvent.duration,
				timezone: originalEvent.timezone,
				eventStatus: originalEvent.eventStatus,
				eventAttendanceMode: originalEvent.eventAttendanceMode,
				maximumAttendeeCapacity: originalEvent.maximumAttendeeCapacity,
				visibility: 'PUBLIC',
				userId,
				attributedTo: `${baseUrl}/users/${shareUser.username}`,
				sharedEventId: originalEvent.id,
			},
			include: includeShareRelations,
		})

		const announceActivity = buildAnnounceEventActivity(
			shareUser,
			originalEventUrl,
			originalEvent.visibility,
			originalActorUrl ?? undefined
		)
		const addressing = buildAddressingFromActivity(announceActivity)
		await deliverActivity(announceActivity, addressing, userId)

		const { broadcast, BroadcastEvents } = await import('./realtime.js')
		await broadcast({
			type: BroadcastEvents.EVENT_SHARED,
			data: {
				share: {
					id: share.id,
					originalEventId: originalEvent.id,
					userId,
				},
			},
		})

		return c.json({ share, alreadyShared: false }, 201)
	} catch (error) {
		console.error('Error sharing event:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Maps event field names to their transformation/sanitization functions
const eventFieldTransformers: Record<string, (val: unknown) => unknown> = {
	title: (val) => sanitizeText(val as string),
	summary: (val) => (val ? sanitizeText(val as string) : null),
	description: (val) => (val ? sanitizeText(val as string) : null),
	location: (val) => (val ? sanitizeText(val as string) : null),
	locationLatitude: (val) => (val === null || val === undefined ? null : val),
	locationLongitude: (val) => (val === null || val === undefined ? null : val),
	headerImage: (val) => (val ? val : null),
	url: (val) => (val ? val : null),
	startTime: (val) => new Date(val as string),
	endTime: (val) => (val === null || val === undefined ? null : new Date(val as string)),
	duration: (val) => (val ? val : null),
	eventStatus: (val) => (val ? val : null),
	eventAttendanceMode: (val) => (val ? val : null),
	maximumAttendeeCapacity: (val) => (val === null || val === undefined ? null : val),
	remainingAttendeeCapacity: (val) => (val === null || val === undefined ? null : val),
	updatedAt: (val) => (val === null || val === undefined ? null : new Date(val as string)),
	timezone: (val) => normalizeTimeZone(val as string),
	recurrencePattern: (val) => (val === null || val === undefined ? null : val),
	recurrenceEndDate: (val) =>
		val === null || val === undefined ? null : new Date(val as string),
}

// Helper function to build update data from validated input
function buildEventUpdateData(
	validatedData: Partial<z.infer<typeof EventSchema>> & { visibility?: string },
	requestedVisibility: string | undefined,
	recurrenceData?: {
		recurrencePattern: RecurrencePattern | null
		recurrenceEndDate: Date | null
	}
) {
	const updateData: Record<string, unknown> = {}

	const updatableKeys = Object.keys(eventFieldTransformers) as Array<
		keyof typeof eventFieldTransformers
	>

	const validatedDataRecord = validatedData as Record<string, unknown>
	for (const key of updatableKeys) {
		if (key in validatedDataRecord && validatedDataRecord[key] !== undefined) {
			updateData[key] = eventFieldTransformers[key](validatedDataRecord[key])
		}
	}

	if (requestedVisibility !== undefined) {
		updateData.visibility = requestedVisibility
	}

	// Apply validated recurrence fields if provided
	if (recurrenceData) {
		if (validatedData.recurrencePattern !== undefined) {
			updateData.recurrencePattern = recurrenceData.recurrencePattern
		}
		if (validatedData.recurrenceEndDate !== undefined) {
			updateData.recurrenceEndDate = recurrenceData.recurrenceEndDate
		}
	}

	return updateData
}

// Helper function to normalize tags with error handling
function normalizeTagsSafely(tags: unknown): string[] {
	try {
		return Array.isArray(tags) && tags.length > 0 ? normalizeTags(tags) : []
	} catch (error) {
		console.error('Error normalizing tags in update:', error)
		throw error
	}
}

// Helper function to update event tags in transaction
async function updateEventTags(
	tx: Prisma.TransactionClient,
	eventId: string,
	normalizedTags: string[]
) {
	await tx.eventTag.deleteMany({
		where: { eventId },
	})

	if (normalizedTags.length > 0) {
		await tx.eventTag.createMany({
			data: normalizedTags.map((tag) => ({
				eventId,
				tag,
			})),
		})
	}
}

// Helper function to broadcast event update
async function broadcastEventUpdate(
	event: Prisma.EventGetPayload<{ include: { user: true; tags: true } }>
) {
	const { broadcast, BroadcastEvents } = await import('./realtime.js')
	const userId = event.userId
	const visibility = event.visibility

	if (!userId) return

	const broadcastTarget = getBroadcastTarget(visibility as EventVisibility | null, userId)

	// These fields should always exist on an event from the database
	const startTime = event.startTime
	const createdAt = event.createdAt
	const updatedAt = event.updatedAt
	const endTime = event.endTime

	if (!startTime || !createdAt || !updatedAt) {
		throw new Error('Event missing required timestamp fields')
	}

	await broadcast({
		type: BroadcastEvents.EVENT_UPDATED,
		data: {
			event: {
				...event,
				startTime: startTime.toISOString(),
				endTime: endTime?.toISOString(),
				createdAt: createdAt.toISOString(),
				updatedAt: updatedAt.toISOString(),
			},
		},
		...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
	})
}

// Extracts and validates recurrence rules from the request
function getValidatedRecurrence(
	validatedData: Partial<z.infer<typeof UpdateEventSchema>>,
	existingEvent: Event
) {
	const nextStartTime = validatedData.startTime
		? new Date(validatedData.startTime)
		: existingEvent.startTime
	const nextRecurrencePattern =
		validatedData.recurrencePattern !== undefined
			? validatedData.recurrencePattern || null
			: existingEvent.recurrencePattern
	let nextRecurrenceEndDate
	if (validatedData.recurrenceEndDate !== undefined) {
		if (validatedData.recurrenceEndDate) {
			nextRecurrenceEndDate = new Date(validatedData.recurrenceEndDate)
		} else {
			nextRecurrenceEndDate = null
		}
	} else {
		nextRecurrenceEndDate = existingEvent.recurrenceEndDate
	}

	validateRecurrenceInput(nextStartTime, nextRecurrencePattern, nextRecurrenceEndDate)
	return { nextRecurrencePattern, nextRecurrenceEndDate }
}

// Updates the event and its tags within a single database transaction
async function updateEventAndTagsInTransaction(
	id: string,
	updateData: Record<string, unknown>,
	normalizedTags: string[] | undefined
) {
	return prisma.$transaction(async (tx) => {
		await tx.event.update({
			where: { id },
			data: { ...updateData, updatedAt: new Date() },
		})

		if (normalizedTags !== undefined) {
			await updateEventTags(tx, id, normalizedTags)
		}

		const refreshedEvent = await tx.event.findUnique({
			where: { id },
			include: { user: true, tags: true },
		})

		if (!refreshedEvent) {
			// Event not found after successful update - this indicates a data consistency issue
			throw new Error('Failed to retrieve updated event after transaction')
		}
		return refreshedEvent
	})
}

// Update event
app.put('/:id', moderateRateLimit, async (c) => {
	try {
		const { id } = c.req.param()
		const userId = requireAuth(c)

		const body: unknown = await c.req.json()
		const validatedData = UpdateEventSchema.parse(body)

		const existingEvent = await prisma.event.findUnique({
			where: { id },
			include: { user: true },
		})
		const ownership = validateEventOwnership(existingEvent, userId, c)
		if (ownership instanceof Response) return ownership
		const ownedEvent = ownership

		const { nextRecurrencePattern, nextRecurrenceEndDate } = getValidatedRecurrence(
			validatedData,
			ownedEvent
		)

		const updateData = buildEventUpdateData(validatedData, validatedData.visibility, {
			recurrencePattern: nextRecurrencePattern,
			recurrenceEndDate: nextRecurrenceEndDate,
		})

		const tagsResult = tryNormalizeTags(validatedData.tags)
		if (!tagsResult.ok) {
			return c.json(
				{
					error: 'VALIDATION_ERROR',
					message: 'Failed to process tags: ensure tags are valid strings',
					details: config.isDevelopment
						? { originalError: String(tagsResult.error) }
						: undefined,
				},
				400
			)
		}

		const event = await updateEventAndTagsInTransaction(id, updateData, tagsResult.tags)

		if (!event.user) {
			throw new Error('Event missing user data - data integrity issue')
		}

		await deliverEventUpdate(event, userId)

		return c.json(event)
	} catch (error) {
		if (error instanceof ZodError) {
			const latError = error.issues.find((issue) => issue.path.includes('locationLatitude'))
			const errorMessage = latError?.message || 'Validation failed'
			return c.json({ error: errorMessage, details: error.issues }, 400 as const)
		}
		console.error('Error updating event:', error)
		const errorMessage = error instanceof Error ? error.message : String(error)
		const errorStack = error instanceof Error ? error.stack : undefined
		return c.json(
			{
				error: 'Internal server error',
				...(config.isDevelopment && {
					message: errorMessage,
					stack: errorStack,
				}),
			},
			500
		)
	}
})

type EventWithOwner = Prisma.EventGetPayload<{ include: { user: true } }>
type EventWithUser = Prisma.EventGetPayload<{ include: { user: true; tags: true } }>

function validateEventOwnership(
	event: EventWithOwner | null,
	userId: string,
	c: { json: (body: Record<string, unknown>, status?: number) => Response }
) {
	if (!event) {
		return c.json({ error: 'Event not found' }, 404)
	}

	if (event.userId !== userId) {
		return c.json({ error: 'Forbidden' }, 403)
	}

	return event
}

function tryNormalizeTags(tags: string[] | undefined) {
	if (tags === undefined) {
		return { ok: true as const, tags: undefined }
	}

	try {
		return { ok: true as const, tags: normalizeTagsSafely(tags) }
	} catch (error) {
		return { ok: false as const, error }
	}
}

async function deliverEventUpdate(event: EventWithUser, userId: string) {
	const activity = buildUpdateEventActivity({ ...event, user: event.user }, userId)
	await deliverActivity(activity, buildAddressingFromActivity(activity), userId)
	await broadcastEventUpdate(event)
}

// Delete event
app.delete('/:id', moderateRateLimit, async (c) => {
	try {
		const { id } = c.req.param()
		const userId = requireAuth(c)

		// Check ownership
		const event = await prisma.event.findUnique({
			where: { id },
		})

		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}

		if (event.userId !== userId) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		// Build Delete activity before deleting
		const activity = buildDeleteEventActivity(id, user, event.visibility)

		// Get event externalId for broadcast
		const eventExternalId = event.externalId || `${getBaseUrl()}/events/${id}`

		// Delete event (cascades to related records)
		await prisma.event.delete({
			where: { id },
		})

		const addressing = buildAddressingFromActivity(activity)
		await deliverActivity(activity, addressing, userId)

		// Broadcast real-time update
		const { broadcast, BroadcastEvents } = await import('./realtime.js')
		const broadcastTarget = getBroadcastTarget(event.visibility, userId)
		await broadcast({
			type: BroadcastEvents.EVENT_DELETED,
			data: {
				eventId: id,
				externalId: eventExternalId,
			},
			...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
		})

		return c.json({ success: true })
	} catch (error) {
		console.error('Error deleting event:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
