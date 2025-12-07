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
})
