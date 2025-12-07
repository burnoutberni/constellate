import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import recommendationsApp from '../recommendations.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(),
}))

const app = new Hono()
app.route('/api/recommendations', recommendationsApp)

describe('Event recommendations API', () => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://test.local'
    let viewer: { id: string; username: string }
    let organizer: { id: string; username: string }

    beforeEach(async () => {
        vi.clearAllMocks()

        viewer = await prisma.user.create({
            data: {
                username: `viewer_${Date.now()}`,
                email: `viewer_${Date.now()}@test.com`,
                name: 'Viewer',
                isRemote: false,
            },
        })

        organizer = await prisma.user.create({
            data: {
                username: `organizer_${Date.now()}`,
                email: `organizer_${Date.now()}@test.com`,
                name: 'Organizer',
                isRemote: false,
            },
        })

        vi.mocked(requireAuth).mockReturnValue(viewer.id)
    })

    it('returns personalized recommendations based on tag interest', async () => {
        const engagedEvent = await prisma.event.create({
            data: {
                title: 'Past Music Meetup',
                startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                userId: organizer.id,
                attributedTo: `${baseUrl}/users/${organizer.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        await prisma.eventAttendance.create({
            data: {
                eventId: engagedEvent.id,
                userId: viewer.id,
                status: 'attending',
            },
        })

        const recommendedEvent = await prisma.event.create({
            data: {
                title: 'Jazz Night Downtown',
                startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                userId: organizer.id,
                attributedTo: `${baseUrl}/users/${organizer.username}`,
                tags: {
                    create: [{ tag: 'music' }, { tag: 'jazz' }],
                },
            },
        })

        const response = await app.request('/api/recommendations?limit=2')
        const body = await response.json() as {
            recommendations: Array<{ event: { id: string }; reasons: string[] }>
        }

        expect(response.status).toBe(200)
        expect(body.recommendations).toHaveLength(1)
        expect(body.recommendations[0].event.id).toBe(recommendedEvent.id)
        expect(body.recommendations[0].reasons.join(' ')).toContain('#music')
    })

    it('falls back to popular upcoming events when no signals exist', async () => {
        vi.mocked(requireAuth).mockReturnValue(viewer.id)

        const otherUser = await prisma.user.create({
            data: {
                username: `attendee_${Date.now()}`,
                email: `attendee_${Date.now()}@test.com`,
                name: 'Attendee',
                isRemote: false,
            },
        })

        const popularEvent = await prisma.event.create({
            data: {
                title: 'Community Garden Day',
                startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                userId: organizer.id,
                attributedTo: `${baseUrl}/users/${organizer.username}`,
                tags: {
                    create: [{ tag: 'outdoors' }],
                },
            },
        })

        await prisma.eventAttendance.create({
            data: {
                eventId: popularEvent.id,
                userId: otherUser.id,
                status: 'attending',
            },
        })

        const response = await app.request('/api/recommendations')
        const body = await response.json() as {
            recommendations: Array<{ event: { id: string }; reasons: string[] }>
        }

        expect(response.status).toBe(200)
        expect(body.recommendations[0].event.id).toBe(popularEvent.id)
        expect(body.recommendations[0].reasons.length).toBeGreaterThan(0)
    })

    it('returns 401 when authentication fails', async () => {
        vi.mocked(requireAuth).mockImplementation(() => {
            throw new AppError('UNAUTHORIZED', 'Authentication required', 401)
        })

        const response = await app.request('/api/recommendations')
        expect(response.status).toBe(401)
    })
})
