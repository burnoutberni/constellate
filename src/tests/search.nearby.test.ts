import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'

const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

describe('Search API - Nearby events', () => {
    beforeEach(async () => {
        await prisma.eventTag.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})
    })

    it('returns events sorted by distance within the requested radius', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'geo_alice',
                email: 'geo_alice@test.com',
                name: 'Geo Alice',
            },
        })

        const nycEvent = await prisma.event.create({
            data: {
                title: 'Manhattan Meetup',
                startTime: new Date(Date.now() + 3600_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'New York, NY',
                locationLatitude: 40.758,
                locationLongitude: -73.9855,
            },
        })

        const philadelphiaEvent = await prisma.event.create({
            data: {
                title: 'Philly Gathering',
                startTime: new Date(Date.now() + 7200_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Philadelphia, PA',
                locationLatitude: 39.9526,
                locationLongitude: -75.1652,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Los Angeles Party',
                startTime: new Date(Date.now() + 10800_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Los Angeles, CA',
                locationLatitude: 34.0522,
                locationLongitude: -118.2437,
            },
        })

        const response = await app.request('/api/search/nearby?latitude=40.7128&longitude=-74.0060&radiusKm=200&limit=5')
        expect(response.status).toBe(200)

        const body = await response.json() as { events: Array<{ id: string; distanceKm: number }> }
        expect(body.events.length).toBe(2)
        expect(body.events[0].id).toBe(nycEvent.id)
        expect(body.events[1].id).toBe(philadelphiaEvent.id)
        expect(body.events[0].distanceKm).toBeLessThan(body.events[1].distanceKm)
    })

    it('excludes events outside the requested radius', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'geo_bob',
                email: 'geo_bob@test.com',
                name: 'Geo Bob',
            },
        })

        const nearby = await prisma.event.create({
            data: {
                title: 'Central Park Picnic',
                startTime: new Date(Date.now() + 3600_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Central Park, NY',
                locationLatitude: 40.7812,
                locationLongitude: -73.9665,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Boston Tech Talk',
                startTime: new Date(Date.now() + 7200_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Boston, MA',
                locationLatitude: 42.3601,
                locationLongitude: -71.0589,
            },
        })

        const response = await app.request('/api/search/nearby?latitude=40.7812&longitude=-73.9665&radiusKm=10')
        expect(response.status).toBe(200)

        const body = await response.json() as { events: Array<{ id: string }> }
        expect(body.events.length).toBe(1)
        expect(body.events[0].id).toBe(nearby.id)
    })

    it('rejects searches at extreme latitudes (beyond ±85°)', async () => {
        const response1 = await app.request('/api/search/nearby?latitude=86&longitude=0&radiusKm=10')
        expect(response1.status).toBe(400)
        const body1 = await response1.json() as { error: string }
        expect(body1.error).toContain('poles')

        const response2 = await app.request('/api/search/nearby?latitude=-86&longitude=0&radiusKm=10')
        expect(response2.status).toBe(400)
        const body2 = await response2.json() as { error: string }
        expect(body2.error).toContain('poles')
    })

    it('rejects invalid radius values exceeding schema limits', async () => {
        // The schema limits radiusKm to max 500km
        const response = await app.request('/api/search/nearby?latitude=0&longitude=0&radiusKm=1000')
        expect(response.status).toBe(400)
        const body = await response.json() as { error: string; details?: unknown }
        // Should be rejected by schema validation (max 500)
        expect(body.error).toBeDefined()
    })

    it('rejects invalid latitude values', async () => {
        const response1 = await app.request('/api/search/nearby?latitude=91&longitude=0&radiusKm=10')
        expect(response1.status).toBe(400)

        const response2 = await app.request('/api/search/nearby?latitude=-91&longitude=0&radiusKm=10')
        expect(response2.status).toBe(400)

        const response3 = await app.request('/api/search/nearby?latitude=invalid&longitude=0&radiusKm=10')
        expect(response3.status).toBe(400)
    })

    it('rejects invalid longitude values', async () => {
        const response1 = await app.request('/api/search/nearby?latitude=0&longitude=181&radiusKm=10')
        expect(response1.status).toBe(400)

        const response2 = await app.request('/api/search/nearby?latitude=0&longitude=-181&radiusKm=10')
        expect(response2.status).toBe(400)

        const response3 = await app.request('/api/search/nearby?latitude=0&longitude=invalid&radiusKm=10')
        expect(response3.status).toBe(400)
    })

    it('excludes events without coordinates (null locationLatitude or locationLongitude)', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'geo_no_coords',
                email: 'geo_no_coords@test.com',
                name: 'No Coords User',
            },
        })

        const eventWithCoords = await prisma.event.create({
            data: {
                title: 'Event With Location',
                startTime: new Date(Date.now() + 3600_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Event Without Coordinates',
                startTime: new Date(Date.now() + 7200_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Somewhere',
                locationLatitude: null,
                locationLongitude: null,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Event With Partial Coordinates',
                startTime: new Date(Date.now() + 10800_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'Somewhere Else',
                locationLatitude: 40.7128,
                locationLongitude: null,
            },
        })

        const response = await app.request('/api/search/nearby?latitude=40.7128&longitude=-74.0060&radiusKm=50')
        expect(response.status).toBe(200)

        const body = await response.json() as { events: Array<{ id: string }> }
        expect(body.events.length).toBe(1)
        expect(body.events[0].id).toBe(eventWithCoords.id)
    })

    it('only returns public events for unauthenticated requests', async () => {
        const publicUser = await prisma.user.create({
            data: {
                username: 'public_user',
                email: 'public@test.com',
                name: 'Public User',
            },
        })

        const privateUser = await prisma.user.create({
            data: {
                username: 'private_user',
                email: 'private@test.com',
                name: 'Private User',
            },
        })

        const publicEvent = await prisma.event.create({
            data: {
                title: 'Public Event',
                startTime: new Date(Date.now() + 3600_000),
                userId: publicUser.id,
                attributedTo: `${baseUrl}/users/${publicUser.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'PUBLIC',
            },
        })

        await prisma.event.create({
            data: {
                title: 'Private Event',
                startTime: new Date(Date.now() + 7200_000),
                userId: privateUser.id,
                attributedTo: `${baseUrl}/users/${privateUser.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'PRIVATE',
            },
        })

        await prisma.event.create({
            data: {
                title: 'Followers Only Event',
                startTime: new Date(Date.now() + 10800_000),
                userId: privateUser.id,
                attributedTo: `${baseUrl}/users/${privateUser.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'FOLLOWERS',
            },
        })

        const response = await app.request('/api/search/nearby?latitude=40.7128&longitude=-74.0060&radiusKm=10')
        expect(response.status).toBe(200)

        const body = await response.json() as { events: Array<{ id: string }> }
        expect(body.events.length).toBe(1)
        expect(body.events[0].id).toBe(publicEvent.id)
    })

    it('excludes private events for unauthenticated requests', async () => {
        const user = await prisma.user.create({
            data: {
                username: 'auth_user',
                email: 'auth@test.com',
                name: 'Auth User',
            },
        })

        const ownPrivateEvent = await prisma.event.create({
            data: {
                title: 'My Private Event',
                startTime: new Date(Date.now() + 3600_000),
                userId: user.id,
                attributedTo: `${baseUrl}/users/${user.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'PRIVATE',
            },
        })

        const otherUser = await prisma.user.create({
            data: {
                username: 'other_user',
                email: 'other@test.com',
                name: 'Other User',
            },
        })

        await prisma.event.create({
            data: {
                title: 'Other User Private Event',
                startTime: new Date(Date.now() + 7200_000),
                userId: otherUser.id,
                attributedTo: `${baseUrl}/users/${otherUser.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'PRIVATE',
            },
        })

        const response = await app.request('/api/search/nearby?latitude=40.7128&longitude=-74.0060&radiusKm=10')
        expect(response.status).toBe(200)

        // Without authentication, only public events should be returned
        const body = await response.json() as { events: Array<{ id: string }> }
        // Should not include private events when unauthenticated
        expect(body.events.find(e => e.id === ownPrivateEvent.id)).toBeUndefined()
    })

    it('excludes followers-only events for unauthenticated requests', async () => {
        const creator = await prisma.user.create({
            data: {
                username: 'creator',
                email: 'creator@test.com',
                name: 'Creator',
            },
        })

        const follower = await prisma.user.create({
            data: {
                username: 'follower',
                email: 'follower@test.com',
                name: 'Follower',
            },
        })

        // Create a following relationship
        await prisma.following.create({
            data: {
                userId: follower.id,
                actorUrl: `${baseUrl}/users/${creator.username}`,
                username: creator.username,
                inboxUrl: `${baseUrl}/users/${creator.username}/inbox`,
                accepted: true,
            },
        })

        const followersEvent = await prisma.event.create({
            data: {
                title: 'Followers Only Event',
                startTime: new Date(Date.now() + 3600_000),
                userId: creator.id,
                attributedTo: `${baseUrl}/users/${creator.username}`,
                location: 'New York, NY',
                locationLatitude: 40.7128,
                locationLongitude: -74.0060,
                visibility: 'FOLLOWERS',
            },
        })

        // Without authentication, followers-only events should not be returned
        const response = await app.request('/api/search/nearby?latitude=40.7128&longitude=-74.0060&radiusKm=10')
        expect(response.status).toBe(200)

        const body = await response.json() as { events: Array<{ id: string }> }
        // Should not include followers-only events when unauthenticated
        expect(body.events.find(e => e.id === followersEvent.id)).toBeUndefined()
    })
})
