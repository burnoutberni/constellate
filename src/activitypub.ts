/**
 * ActivityPub Endpoints
 * WebFinger, Actor, Inbox, Outbox, and Collections
 */

import { Hono } from 'hono'
import { getBaseUrl, createOrderedCollection, createOrderedCollectionPage } from './lib/activitypubHelpers.js'
import { verifySignature } from './lib/httpSignature.js'
import { ActivitySchema, PersonSchema, EventSchema } from './lib/activitypubSchemas.js'
import { ACTIVITYPUB_CONTEXTS, ContentType, ObjectType, PAGINATION } from './constants/activitypub.js'
import { handleActivity } from './federation.js'
import { prisma } from './lib/prisma.js'

const app = new Hono()

// WebFinger discovery
app.get('/.well-known/webfinger', async (c) => {
    try {
        const resource = c.req.query('resource')

        if (!resource) {
            return c.json({ error: 'Missing resource parameter' }, 400)
        }

        // Parse resource (acct:username@domain)
        const match = resource.match(/^acct:([^@]+)@(.+)$/)
        if (!match) {
            return c.json({ error: 'Invalid resource format' }, 400)
        }

        const [, username, domain] = match
        const baseUrl = getBaseUrl()
        const expectedDomain = new URL(baseUrl).hostname

        if (domain !== expectedDomain) {
            return c.json({ error: 'Domain mismatch' }, 404)
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const actorUrl = `${baseUrl}/users/${username}`

        return c.json({
            subject: resource,
            aliases: [actorUrl],
            links: [
                {
                    rel: 'self',
                    type: ContentType.ACTIVITY_JSON,
                    href: actorUrl,
                },
                {
                    rel: 'https://webfinger.net/rel/profile-page',
                    type: 'text/html',
                    href: actorUrl,
                },
            ],
        })
    } catch (error) {
        console.error('WebFinger error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// NodeInfo discovery
app.get('/.well-known/nodeinfo', async (c) => {
    const baseUrl = getBaseUrl()
    return c.json({
        links: [
            {
                rel: 'https://nodeinfo.diaspora.software/ns/schema/2.0',
                href: `${baseUrl}/nodeinfo/2.0`,
            },
        ],
    })
})

app.get('/nodeinfo/2.0', async (c) => {
    const userCount = await prisma.user.count({ where: { isRemote: false } })
    const eventCount = await prisma.event.count({ where: { userId: { not: null } } })

    return c.json({
        version: '2.0',
        software: {
            name: 'stellar-calendar',
            version: '1.0.0',
        },
        protocols: ['activitypub'],
        services: {
            inbound: [],
            outbound: [],
        },
        openRegistrations: true,
        usage: {
            users: {
                total: userCount,
            },
            localPosts: eventCount,
        },
        metadata: {
            nodeName: 'Stellar Calendar',
            nodeDescription: 'Federated event management platform',
        },
    })
})

// Actor endpoint
app.get('/users/:username', async (c) => {
    try {
        const { username } = c.req.param()
        const baseUrl = getBaseUrl()

        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Generate keys if user doesn't have them
        if (!user.publicKey || !user.privateKey) {
            const { generateKeyPairSync } = await import('crypto')
            const { encryptPrivateKey } = await import('./lib/encryption.js')
            const { publicKey, privateKey } = generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem',
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem',
                },
            })

            // Encrypt private key before storing
            const encryptedPrivateKey = encryptPrivateKey(privateKey)

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    publicKey,
                    privateKey: encryptedPrivateKey,
                },
            })

            user.publicKey = publicKey
            user.privateKey = encryptedPrivateKey
            console.log(`✅ Generated and encrypted keys for user: ${username}`)
        }

        const actorUrl = `${baseUrl}/users/${username}`

        const actor = {
            '@context': ACTIVITYPUB_CONTEXTS,
            type: ObjectType.PERSON,
            id: actorUrl,
            preferredUsername: username,
            name: user.name || username,
            summary: user.bio || undefined,
            inbox: `${actorUrl}/inbox`,
            outbox: `${actorUrl}/outbox`,
            followers: `${actorUrl}/followers`,
            following: `${actorUrl}/following`,
            publicKey: {
                id: `${actorUrl}#main-key`,
                owner: actorUrl,
                publicKeyPem: user.publicKey!,
            },
            icon: user.profileImage
                ? {
                    type: ObjectType.IMAGE,
                    url: user.profileImage,
                }
                : undefined,
            image: user.headerImage
                ? {
                    type: ObjectType.IMAGE,
                    url: user.headerImage,
                }
                : undefined,
            endpoints: {
                sharedInbox: `${baseUrl}/inbox`,
            },
            displayColor: user.displayColor,
        }

        // Validate before returning
        PersonSchema.parse(actor)

        return c.json(actor, 200, {
            'Content-Type': ContentType.ACTIVITY_JSON,
        })
    } catch (error) {
        console.error('Actor endpoint error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Followers collection
app.get('/users/:username/followers', async (c) => {
    try {
        const { username } = c.req.param()
        const page = c.req.query('page')
        const baseUrl = getBaseUrl()

        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const collectionUrl = `${baseUrl}/users/${username}/followers`

        if (!page) {
            // Return collection
            const totalFollowers = await prisma.follower.count({
                where: { userId: user.id, accepted: true },
            })

            return c.json(
                createOrderedCollection(
                    collectionUrl,
                    [],
                    totalFollowers
                ),
                200,
                { 'Content-Type': ContentType.ACTIVITY_JSON }
            )
        }

        // Return page
        const pageNum = parseInt(page)
        const limit = PAGINATION.DEFAULT_PAGE_SIZE
        const skip = (pageNum - 1) * limit

        const followers = await prisma.follower.findMany({
            where: { userId: user.id, accepted: true },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        })

        const actorUrls = followers.map(f => f.actorUrl)

        const nextPage = followers.length === limit
            ? `${collectionUrl}?page=${pageNum + 1}`
            : undefined

        const prevPage = pageNum > 1
            ? `${collectionUrl}?page=${pageNum - 1}`
            : undefined

        return c.json(
            createOrderedCollectionPage(
                `${collectionUrl}?page=${pageNum}`,
                actorUrls,
                collectionUrl,
                nextPage,
                prevPage
            ),
            200,
            { 'Content-Type': ContentType.ACTIVITY_JSON }
        )
    } catch (error) {
        console.error('Followers collection error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Following collection
app.get('/users/:username/following', async (c) => {
    try {
        const { username } = c.req.param()
        const page = c.req.query('page')
        const baseUrl = getBaseUrl()

        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const collectionUrl = `${baseUrl}/users/${username}/following`

        if (!page) {
            // Return collection
            const totalFollowing = await prisma.following.count({
                where: { userId: user.id, accepted: true },
            })

            return c.json(
                createOrderedCollection(
                    collectionUrl,
                    [],
                    totalFollowing
                ),
                200,
                { 'Content-Type': ContentType.ACTIVITY_JSON }
            )
        }

        // Return page
        const pageNum = parseInt(page)
        const limit = PAGINATION.DEFAULT_PAGE_SIZE
        const skip = (pageNum - 1) * limit

        const following = await prisma.following.findMany({
            where: { userId: user.id, accepted: true },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        })

        const actorUrls = following.map(f => f.actorUrl)

        const nextPage = following.length === limit
            ? `${collectionUrl}?page=${pageNum + 1}`
            : undefined

        const prevPage = pageNum > 1
            ? `${collectionUrl}?page=${pageNum - 1}`
            : undefined

        return c.json(
            createOrderedCollectionPage(
                `${collectionUrl}?page=${pageNum}`,
                actorUrls,
                collectionUrl,
                nextPage,
                prevPage
            ),
            200,
            { 'Content-Type': ContentType.ACTIVITY_JSON }
        )
    } catch (error) {
        console.error('Following collection error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Outbox collection
app.get('/users/:username/outbox', async (c) => {
    try {
        const { username } = c.req.param()
        const page = c.req.query('page')
        const baseUrl = getBaseUrl()

        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const collectionUrl = `${baseUrl}/users/${username}/outbox`

        if (!page) {
            // Return collection
            const totalEvents = await prisma.event.count({
                where: { userId: user.id },
            })

            return c.json(
                createOrderedCollection(
                    collectionUrl,
                    [],
                    totalEvents
                ),
                200,
                { 'Content-Type': ContentType.ACTIVITY_JSON }
            )
        }

        // Return page with events as Create activities
        const pageNum = parseInt(page)
        const limit = PAGINATION.DEFAULT_PAGE_SIZE
        const skip = (pageNum - 1) * limit

        const events = await prisma.event.findMany({
            where: { userId: user.id },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { user: true },
        })

        const activities = events.map(event => {
            const actorUrl = `${baseUrl}/users/${username}`
            const eventUrl = `${baseUrl}/events/${event.id}`

            return {
                '@context': ACTIVITYPUB_CONTEXTS,
                id: `${actorUrl}/activities/${event.id}/create`,
                type: 'Create',
                actor: actorUrl,
                published: event.createdAt.toISOString(),
                object: {
                    type: ObjectType.EVENT,
                    id: eventUrl,
                    name: event.title,
                    summary: event.summary || undefined,
                    startTime: event.startTime.toISOString(),
                    endTime: event.endTime?.toISOString(),
                    location: event.location || undefined,
                    attributedTo: actorUrl,
                },
            }
        })

        const nextPage = events.length === limit
            ? `${collectionUrl}?page=${pageNum + 1}`
            : undefined

        const prevPage = pageNum > 1
            ? `${collectionUrl}?page=${pageNum - 1}`
            : undefined

        return c.json(
            createOrderedCollectionPage(
                `${collectionUrl}?page=${pageNum}`,
                activities,
                collectionUrl,
                nextPage,
                prevPage
            ),
            200,
            { 'Content-Type': ContentType.ACTIVITY_JSON }
        )
    } catch (error) {
        console.error('Outbox collection error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Personal inbox
app.post('/users/:username/inbox', async (c) => {
    try {
        const { username } = c.req.param()

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { username, isRemote: false },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Verify HTTP signature
        const signature = c.req.header('signature')
        if (!signature) {
            return c.json({ error: 'Missing signature' }, 401)
        }

        const method = c.req.method
        const url = new URL(c.req.url)
        const path = url.pathname + url.search // Include query string if present
        const headers: Record<string, string> = {}
        c.req.raw.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value
        })

        // Use the target server's hostname for signature verification
        // The signature was created with the target host (app1.local), not the sender's host
        // This handles reverse proxy scenarios where Host header is changed to localhost:3000
        const baseUrl = getBaseUrl()
        const targetHost = new URL(baseUrl).hostname
        if (headers['host'] && !headers['host'].includes(targetHost)) {
            console.log(`[Inbox] Using target host: ${targetHost} (instead of ${headers['host']})`)
            headers['host'] = targetHost
        }

        const isValid = await verifySignature(signature, method, path, headers)
        if (!isValid) {
            console.error(`[Inbox] Signature verification failed for ${method} ${path}`)
            console.error(`[Inbox] Signature: ${signature.substring(0, 100)}...`)
            return c.json({ error: 'Invalid signature' }, 401)
        }

        // Parse activity
        const activity = await c.req.json()

        // Validate activity
        try {
            ActivitySchema.parse(activity)
        } catch (error) {
            console.error('Activity validation failed:', error)
            return c.json({ error: 'Invalid activity' }, 400)
        }

        // Handle activity asynchronously
        handleActivity(activity).catch(error => {
            console.error('Error handling activity:', error)
        })

        return c.json({ status: 'accepted' }, 202)
    } catch (error) {
        console.error('Inbox error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Shared inbox
app.post('/inbox', async (c) => {
    try {
        // Verify HTTP signature
        const signature = c.req.header('signature')
        if (!signature) {
            return c.json({ error: 'Missing signature' }, 401)
        }

        const method = c.req.method
        const url = new URL(c.req.url)
        const path = url.pathname + url.search // Include query string if present
        const headers: Record<string, string> = {}
        c.req.raw.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value
        })

        // Use the target server's hostname for signature verification
        // The signature was created with the target host (app1.local), not the sender's host
        // This handles reverse proxy scenarios where Host header is changed to localhost:3000
        const baseUrl = getBaseUrl()
        const targetHost = new URL(baseUrl).hostname
        if (headers['host'] && !headers['host'].includes(targetHost)) {
            console.log(`[Shared Inbox] Using target host: ${targetHost} (instead of ${headers['host']})`)
            headers['host'] = targetHost
        }

        const isValid = await verifySignature(signature, method, path, headers)
        if (!isValid) {
            console.error(`[Shared Inbox] Signature verification failed for ${method} ${path}`)
            console.error(`[Shared Inbox] Signature: ${signature.substring(0, 100)}...`)
            return c.json({ error: 'Invalid signature' }, 401)
        }

        // Parse activity
        const activity = await c.req.json()

        // Validate activity
        try {
            ActivitySchema.parse(activity)
        } catch (error) {
            console.error('Activity validation failed:', error)
            return c.json({ error: 'Invalid activity' }, 400)
        }

        // Handle activity asynchronously
        handleActivity(activity).catch(error => {
            console.error('Error handling activity:', error)
        })

        return c.json({ status: 'accepted' }, 202)
    } catch (error) {
        console.error('Shared inbox error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Event as ActivityPub object
app.get('/events/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const baseUrl = getBaseUrl()

        const event = await prisma.event.findUnique({
            where: { id },
            include: { user: true },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        const user = event.user
        const actorUrl = user?.isRemote
            ? user.externalActorUrl!
            : `${baseUrl}/users/${user?.username}`

        const eventUrl = `${baseUrl}/events/${id}`

        const eventObject = {
            '@context': ACTIVITYPUB_CONTEXTS,
            type: ObjectType.EVENT,
            id: eventUrl,
            name: event.title,
            summary: event.summary || undefined,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime?.toISOString(),
            duration: event.duration || undefined,
            location: event.location || undefined,
            url: event.url || undefined,
            attributedTo: actorUrl,
            published: event.createdAt.toISOString(),
            updated: event.updatedAt.toISOString(),
            eventStatus: event.eventStatus || undefined,
            eventAttendanceMode: event.eventAttendanceMode || undefined,
            maximumAttendeeCapacity: event.maximumAttendeeCapacity || undefined,
            attachment: event.headerImage
                ? [
                    {
                        type: ObjectType.IMAGE,
                        url: event.headerImage,
                    },
                ]
                : undefined,
        }

        // Validate before returning
        EventSchema.parse(eventObject)

        return c.json(eventObject, 200, {
            'Content-Type': ContentType.ACTIVITY_JSON,
        })
    } catch (error) {
        console.error('Event object error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
