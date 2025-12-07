import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { buildVisibilityWhere, resolveEventActorUrl } from '../lib/eventVisibility.js'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20
const CANDIDATE_MULTIPLIER = 4
const LOOKBACK_ATTENDANCE = 75
const LOOKBACK_LIKES = 75
const MIN_ATTENDANCE_FOR_POPULARITY_REASON = 5

const eventInclude = {
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
    _count: {
        select: {
            attendance: true,
            likes: true,
            comments: true,
        },
    },
} as const

type EventWithRelations = Prisma.EventGetPayload<{
    include: typeof eventInclude
}>

export interface RecommendationSignals {
    matchedTags: string[]
    followedOrganizer: boolean
    hostAffinity: boolean
    popularityScore: number
}

export interface EventRecommendation {
    event: EventWithRelations
    score: number
    reasons: string[]
    signals: RecommendationSignals
}

interface InterestProfile {
    tagWeights: Map<string, number>
    hostWeights: Map<string, number>
    engagedEventIds: string[]
}

async function buildInterestProfile(userId: string): Promise<InterestProfile> {
    const [attendance, likes] = await Promise.all([
        prisma.eventAttendance.findMany({
            where: {
                userId,
                status: { in: ['attending', 'maybe'] },
            },
            select: {
                eventId: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: LOOKBACK_ATTENDANCE,
        }),
        prisma.eventLike.findMany({
            where: { userId },
            select: {
                eventId: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: LOOKBACK_LIKES,
        }),
    ])

    const eventWeights = new Map<string, number>()
    attendance.forEach(({ eventId }) => {
        eventWeights.set(eventId, (eventWeights.get(eventId) ?? 0) + 2)
    })
    likes.forEach(({ eventId }) => {
        eventWeights.set(eventId, (eventWeights.get(eventId) ?? 0) + 1)
    })

    const engagedEventIds = Array.from(eventWeights.keys())
    if (engagedEventIds.length === 0) {
        return {
            tagWeights: new Map(),
            hostWeights: new Map(),
            engagedEventIds,
        }
    }

    const engagedEvents = await prisma.event.findMany({
        where: { id: { in: engagedEventIds } },
        select: {
            id: true,
            userId: true,
            attributedTo: true,
            tags: {
                select: {
                    tag: true,
                },
            },
        },
    })

    const tagWeights = new Map<string, number>()
    const hostWeights = new Map<string, number>()

    for (const event of engagedEvents) {
        const weight = eventWeights.get(event.id) ?? 1
        for (const tag of event.tags) {
            const normalized = tag.tag.toLowerCase()
            tagWeights.set(normalized, (tagWeights.get(normalized) ?? 0) + weight)
        }

        let hostKey: string | null = null
        if (event.userId) {
            hostKey = `user:${event.userId}`
        } else if (event.attributedTo) {
            hostKey = `actor:${event.attributedTo}`
        }
        if (hostKey) {
            hostWeights.set(hostKey, (hostWeights.get(hostKey) ?? 0) + weight)
        }
    }

    return {
        tagWeights,
        hostWeights,
        engagedEventIds,
    }
}

async function hydrateEventUsers(events: EventWithRelations[]): Promise<EventWithRelations[]> {
    // Collect all unique attributedTo URLs from events without users
    const attributedToUrls = new Set<string>()
    for (const event of events) {
        if (!event.user && event.attributedTo) {
            attributedToUrls.add(event.attributedTo)
        }
    }

    // Fetch all matching remote users in a single query
    const remoteUsers = attributedToUrls.size > 0
        ? await prisma.user.findMany({
              where: { externalActorUrl: { in: Array.from(attributedToUrls) } },
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
        : []

    // Map the results back to events
    const userMap = new Map(remoteUsers.map((user) => [user.externalActorUrl, user]))

    return events.map((event) => {
        if (event.user || !event.attributedTo) {
            return event
        }

        const remoteUser = userMap.get(event.attributedTo)
        if (remoteUser) {
            return { ...event, user: remoteUser }
        }

        return event
    })
}

function formatTagReason(tags: string[]): string {
    const uniqueTags = Array.from(new Set(tags))
    const display = uniqueTags.slice(0, 3).map((tag) => `#${tag}`)
    return `Matches your interest in ${display.join(', ')}`
}

function buildRecommendation(
    event: EventWithRelations,
    options: {
        tagWeights: Map<string, number>
        hostWeights: Map<string, number>
        followedActorUrls: Set<string>
        now: Date
    }
): EventRecommendation {
    const { tagWeights, hostWeights, followedActorUrls, now } = options
    const normalizedTags = event.tags.map((t) => t.tag.toLowerCase())
    const matchedTags = normalizedTags.filter((tag) => tagWeights.has(tag))
    const tagScore = matchedTags.reduce((sum, tag) => sum + (tagWeights.get(tag) ?? 0), 0) * 2

    let hostKey: string | null = null
    if (event.userId) {
        hostKey = `user:${event.userId}`
    } else if (event.attributedTo) {
        hostKey = `actor:${event.attributedTo}`
    }
    const hostAffinityRaw = hostKey ? hostWeights.get(hostKey) ?? 0 : 0
    const hostAffinityScore = hostAffinityRaw * 1.5

    const actorUrl = resolveEventActorUrl(event)
    const followedOrganizer = actorUrl ? followedActorUrls.has(actorUrl) : false
    const followedScore = followedOrganizer ? 6 : 0

    const attendanceCount = event._count?.attendance ?? 0
    const likesCount = event._count?.likes ?? 0
    const commentsCount = event._count?.comments ?? 0
    const popularityScore = attendanceCount * 0.6 + likesCount * 0.3 + commentsCount * 0.2

    const hoursUntilStart = (event.startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const recencyScore = Math.max(0, 3 - Math.max(0, hoursUntilStart) / 24)

    const score = tagScore + hostAffinityScore + followedScore + popularityScore + recencyScore

    const reasons: string[] = []
    if (matchedTags.length > 0) {
        reasons.push(formatTagReason(matchedTags))
    }
    if (followedOrganizer) {
        reasons.push('Hosted by someone you follow')
    }
    if (hostAffinityRaw > 0 && !followedOrganizer) {
        reasons.push('You engaged with this host before')
    }
    if (attendanceCount >= MIN_ATTENDANCE_FOR_POPULARITY_REASON) {
        const peopleText = attendanceCount === 1 ? 'person plans' : 'people plan'
        reasons.push(`Already ${attendanceCount} ${peopleText} to attend`)
    }
    if (reasons.length === 0) {
        reasons.push('Upcoming event that matches your activity')
    }

    return {
        event,
        score,
        reasons,
        signals: {
            matchedTags,
            followedOrganizer,
            hostAffinity: hostAffinityRaw > 0,
            popularityScore,
        },
    }
}

async function fetchCandidateEvents(where: Prisma.EventWhereInput, take: number) {
    const events = await prisma.event.findMany({
        where,
        include: eventInclude,
        orderBy: {
            startTime: 'asc',
        },
        take,
    })

    if (events.length === 0) {
        return events
    }
    return hydrateEventUsers(events)
}

export async function getEventRecommendations(userId: string, limit?: number) {
    const safeLimit = Math.max(1, Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT))
    const candidateTake = Math.min(safeLimit * CANDIDATE_MULTIPLIER, MAX_LIMIT * 3)

    const [interestProfile, following] = await Promise.all([
        buildInterestProfile(userId),
        prisma.following.findMany({
            where: { userId, accepted: true },
            select: { actorUrl: true },
        }),
    ])

    const followedActorUrls = new Set(following.map((f) => f.actorUrl))
    const visibilityWhere = buildVisibilityWhere({ userId, followedActorUrls: Array.from(followedActorUrls) })
    const now = new Date()
    const startTimeCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000) // allow events that just started

    const filters: Prisma.EventWhereInput[] = [
        visibilityWhere,
        { sharedEventId: null },
        {
            startTime: {
                gte: startTimeCutoff,
            },
        },
    ]

    if (interestProfile.engagedEventIds.length > 0) {
        filters.push({
            id: {
                notIn: interestProfile.engagedEventIds,
            },
        })
    }

    filters.push({
        NOT: { userId },
    })

    const candidateWhere = filters.length === 1 ? filters[0] : { AND: filters }

    let candidates = await fetchCandidateEvents(candidateWhere, candidateTake)

    if (candidates.length === 0) {
        candidates = await fetchCandidateEvents(
            {
                visibility: 'PUBLIC',
                sharedEventId: null,
                startTime: { gte: startTimeCutoff },
                NOT: { userId },
            },
            safeLimit
        )
    }

    const recommendations = candidates
        .map((event) =>
            buildRecommendation(event, {
                tagWeights: interestProfile.tagWeights,
                hostWeights: interestProfile.hostWeights,
                followedActorUrls,
                now,
            })
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, safeLimit)

    return {
        recommendations,
        metadata: {
            generatedAt: now.toISOString(),
            signals: {
                tags: interestProfile.tagWeights.size,
                hosts: interestProfile.hostWeights.size,
                followed: followedActorUrls.size,
            },
        },
    }
}
