import type { EventVisibility, Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { getBaseUrl } from './activitypubHelpers.js'

interface EventLike {
    visibility?: EventVisibility | null
    userId?: string | null
    attributedTo?: string | null
    user?: {
        username?: string | null
    } | null
}

interface VisibilityFilterOptions {
    userId?: string | null
    followedActorUrls?: string[]
    includeUnlisted?: boolean
}

const DEFAULT_VISIBILITY: EventVisibility = 'PUBLIC'

export function resolveEventActorUrl(event: EventLike): string | null {
    if (event.attributedTo) {
        return event.attributedTo
    }

    if (event.user?.username) {
        const baseUrl = getBaseUrl()
        return `${baseUrl}/users/${event.user.username}`
    }

    return null
}

export function isPublicVisibility(visibility?: EventVisibility | null): boolean {
    return (visibility || DEFAULT_VISIBILITY) === 'PUBLIC'
}

export function buildVisibilityWhere(options: VisibilityFilterOptions = {}): Prisma.EventWhereInput {
    const { userId, followedActorUrls = [], includeUnlisted = false } = options

    if (!userId) {
        return { visibility: 'PUBLIC' }
    }

    const orConditions: Prisma.EventWhereInput[] = [
        { visibility: 'PUBLIC' },
        { userId },
    ]

    if (includeUnlisted) {
        orConditions.push({ visibility: 'UNLISTED' })
    }

    if (followedActorUrls.length > 0) {
        orConditions.push({
            visibility: 'FOLLOWERS',
            attributedTo: { in: followedActorUrls },
        })
    }

    return { OR: orConditions }
}

async function userFollowsActor(userId: string, actorUrl: string): Promise<boolean> {
    const follow = await prisma.following.findFirst({
        where: {
            userId,
            actorUrl,
            accepted: true,
        },
        select: { id: true },
    })

    return Boolean(follow)
}

export async function canUserViewEvent(event: EventLike, viewerId?: string | null): Promise<boolean> {
    const visibility = event.visibility || DEFAULT_VISIBILITY

    if (visibility === 'PUBLIC' || visibility === 'UNLISTED') {
        return true
    }

    if (!viewerId) {
        return false
    }

    if (event.userId && event.userId === viewerId) {
        return true
    }

    if (visibility === 'PRIVATE') {
        return false
    }

    if (visibility === 'FOLLOWERS') {
        const actorUrl = resolveEventActorUrl(event)
        if (!actorUrl) {
            return false
        }
        return userFollowsActor(viewerId, actorUrl)
    }

    return false
}
