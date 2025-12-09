/**
 * Instance Discovery Helpers
 * Functions for discovering and tracking federated instances
 */

import { prisma } from './prisma.js'
import { safeFetch } from './ssrfProtection.js'
import { ContentType } from '../constants/activitypub.js'

/**
 * Extract domain from actor URL
 */
export function extractDomain(actorUrl: string): string | null {
    try {
        const url = new URL(actorUrl)
        return url.hostname
    } catch {
        return null
    }
}

/**
 * Extract base URL from actor URL
 */
export function extractBaseUrl(actorUrl: string): string | null {
    try {
        const url = new URL(actorUrl)
        // Include port if non-standard
        const port = url.port && url.port !== '80' && url.port !== '443' ? `:${url.port}` : ''
        return `${url.protocol}//${url.hostname}${port}`
    } catch {
        return null
    }
}

/**
 * Fetch instance metadata from NodeInfo
 * https://nodeinfo.diaspora.software/protocol.html
 */
export async function fetchInstanceMetadata(baseUrl: string): Promise<{
    software?: string
    version?: string
    userCount?: number
    eventCount?: number
    title?: string
    description?: string
    iconUrl?: string
    contact?: string
} | null> {
    try {
        // Try to fetch NodeInfo
        const wellKnownUrl = `${baseUrl}/.well-known/nodeinfo`
        const wellKnownResponse = await safeFetch(wellKnownUrl, {
            headers: { Accept: ContentType.JSON },
        }, 5000)

        if (!wellKnownResponse.ok) {
            return null
        }

        const wellKnownData = await wellKnownResponse.json() as {
            links?: Array<{ rel: string; href: string }>
        }

        // Find NodeInfo 2.0 or 2.1 link
        // Note: These are specification URLs as defined by the NodeInfo protocol, not actual HTTP requests
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        const nodeInfoSchema20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0'
        // eslint-disable-next-line sonarjs/no-clear-text-protocols
        const nodeInfoSchema21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1'
        const nodeInfoLink = wellKnownData.links?.find(
            (link) => link.rel === nodeInfoSchema20 || link.rel === nodeInfoSchema21
        )

        if (!nodeInfoLink) {
            return null
        }

        // Fetch NodeInfo
        const nodeInfoResponse = await safeFetch(nodeInfoLink.href, {
            headers: { Accept: ContentType.JSON },
        }, 5000)

        if (!nodeInfoResponse.ok) {
            return null
        }

        const nodeInfo = await nodeInfoResponse.json() as {
            software?: { name?: string; version?: string }
            usage?: { users?: { total?: number }; localPosts?: number; localComments?: number }
            metadata?: { nodeName?: string; nodeDescription?: string; nodeIcon?: string; contact?: string }
        }

        return {
            software: nodeInfo.software?.name,
            version: nodeInfo.software?.version,
            userCount: nodeInfo.usage?.users?.total,
            eventCount: (nodeInfo.usage?.localPosts ?? 0) + (nodeInfo.usage?.localComments ?? 0),
            title: nodeInfo.metadata?.nodeName,
            description: nodeInfo.metadata?.nodeDescription,
            iconUrl: nodeInfo.metadata?.nodeIcon,
            contact: nodeInfo.metadata?.contact,
        }
    } catch (error) {
        console.error('Error fetching instance metadata:', error)
        return null
    }
}

/**
 * Record or update instance information based on actor URL
 */
export async function trackInstance(actorUrl: string): Promise<void> {
    const domain = extractDomain(actorUrl)
    const baseUrl = extractBaseUrl(actorUrl)

    if (!domain || !baseUrl) {
        return
    }

    // Check if instance already exists
    const existingInstance = await prisma.instance.findUnique({
        where: { domain },
    })

    const now = new Date()

    if (existingInstance) {
        // Update last activity time
        await prisma.instance.update({
            where: { domain },
            data: {
                lastActivityAt: now,
            },
        })
    } else {
        // Create new instance record
        const metadata = await fetchInstanceMetadata(baseUrl)

        await prisma.instance.create({
            data: {
                domain,
                baseUrl,
                software: metadata?.software,
                version: metadata?.version,
                userCount: metadata?.userCount,
                eventCount: metadata?.eventCount,
                title: metadata?.title,
                description: metadata?.description,
                iconUrl: metadata?.iconUrl,
                contact: metadata?.contact,
                lastActivityAt: now,
                lastFetchedAt: metadata ? now : null,
            },
        })
    }
}

/**
 * Refresh instance metadata (run periodically or on-demand)
 */
export async function refreshInstanceMetadata(domain: string): Promise<void> {
    try {
        const instance = await prisma.instance.findUnique({
            where: { domain },
        })

        if (!instance) {
            return
        }

        const metadata = await fetchInstanceMetadata(instance.baseUrl)
        const now = new Date()

        if (metadata) {
            await prisma.instance.update({
                where: { domain },
                data: {
                    software: metadata.software,
                    version: metadata.version,
                    userCount: metadata.userCount,
                    eventCount: metadata.eventCount,
                    title: metadata.title,
                    description: metadata.description,
                    iconUrl: metadata.iconUrl,
                    contact: metadata.contact,
                    lastFetchedAt: now,
                    lastError: null,
                    lastErrorAt: null,
                },
            })
        } else {
            await prisma.instance.update({
                where: { domain },
                data: {
                    lastError: 'Failed to fetch instance metadata',
                    lastErrorAt: now,
                },
            })
        }
    } catch (error) {
        console.error('Error refreshing instance metadata:', error)
        await prisma.instance.update({
            where: { domain },
            data: {
                lastError: error instanceof Error ? error.message : 'Unknown error',
                lastErrorAt: new Date(),
            },
        })
    }
}

/**
 * Get all known instances with statistics
 */
export async function getKnownInstances(options: {
    limit?: number
    offset?: number
    sortBy?: 'activity' | 'users' | 'created'
    filterBlocked?: boolean
}) {
    const { limit = 50, offset = 0, sortBy = 'activity', filterBlocked = true } = options

    const where = filterBlocked ? { isBlocked: false } : {}

    let orderBy
    if (sortBy === 'activity') {
        orderBy = { lastActivityAt: 'desc' as const }
    } else if (sortBy === 'users') {
        orderBy = { userCount: 'desc' as const }
    } else {
        orderBy = { createdAt: 'desc' as const }
    }

    const [instances, total] = await Promise.all([
        prisma.instance.findMany({
            where,
            orderBy,
            skip: offset,
            take: limit,
        }),
        prisma.instance.count({ where }),
    ])

    // Get connection stats for all instances in bulk to avoid N+1 queries
    // Fetch all related records that might match any instance
    const [allUsers, allEvents, allFollowings] = await Promise.all([
        prisma.user.findMany({
            where: {
                isRemote: true,
                externalActorUrl: { not: null }
            },
            select: { externalActorUrl: true }
        }),
        prisma.event.findMany({
            where: { externalId: { not: null } },
            select: { externalId: true }
        }),
        prisma.following.findMany({
            where: { actorUrl: { not: null } },
            select: { actorUrl: true }
        })
    ])

    // Count matches in memory for each instance
    const instancesWithStats = instances.map(instance => {
        const urlPatterns = [
            `://${instance.domain}/`,
            `://${instance.domain}:`,
        ]
        
        return {
            ...instance,
            stats: {
                remoteUsers: allUsers.filter(u => 
                    urlPatterns.some(p => u.externalActorUrl?.includes(p))
                ).length,
                remoteEvents: allEvents.filter(e => 
                    urlPatterns.some(p => e.externalId?.includes(p))
                ).length,
                localFollowing: allFollowings.filter(f => 
                    urlPatterns.some(p => f.actorUrl?.includes(p))
                ).length,
            }
        }
    })

    return {
        instances: instancesWithStats,
        total,
        limit,
        offset,
    }
}

/**
 * Search instances by domain or title
 */
export async function searchInstances(query: string, limit = 20) {
    const instances = await prisma.instance.findMany({
        where: {
            AND: [
                { isBlocked: false },
                {
                    OR: [
                        { domain: { contains: query, mode: 'insensitive' } },
                        { title: { contains: query, mode: 'insensitive' } },
                        { description: { contains: query, mode: 'insensitive' } },
                    ],
                },
            ],
        },
        orderBy: { lastActivityAt: 'desc' },
        take: limit,
    })

    return instances
}

/**
 * Get connection statistics for a specific instance
 */
export async function getInstanceStats(domain: string) {
    const urlPatterns = [
        `://${domain}/`,
        `://${domain}:`,
    ]
    
    const [remoteUserCount, remoteEventCount, localFollowingCount, localFollowersCount] = await Promise.all([
        prisma.user.count({
            where: {
                isRemote: true,
                OR: urlPatterns.map(pattern => ({
                    externalActorUrl: {
                        contains: pattern,
                    },
                })),
            },
        }),
        prisma.event.count({
            where: {
                OR: urlPatterns.map(pattern => ({
                    externalId: {
                        contains: pattern,
                    },
                })),
            },
        }),
        prisma.following.count({
            where: {
                OR: urlPatterns.map(pattern => ({
                    actorUrl: {
                        contains: pattern,
                    },
                })),
            },
        }),
        prisma.follower.count({
            where: {
                OR: urlPatterns.map(pattern => ({
                    actorUrl: {
                        contains: pattern,
                    },
                })),
            },
        }),
    ])

    return {
        remoteUsers: remoteUserCount,
        remoteEvents: remoteEventCount,
        localFollowing: localFollowingCount,
        localFollowers: localFollowersCount,
    }
}
