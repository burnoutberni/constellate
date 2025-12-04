import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import templatesApp from '../templates.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

vi.mock('../lib/prisma.js', () => ({
    prisma: {
        eventTemplate: {
            findMany: vi.fn(),
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}))

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(),
}))

const app = new Hono()
app.route('/api', templatesApp)

const baseTemplate = {
    id: 'tmpl_123',
    name: 'Weekly Standup',
    description: 'Short standup template',
    data: {
        title: 'Weekly Standup',
        summary: 'Share updates',
        startTime: new Date().toISOString(),
    },
    userId: 'user_123',
    createdAt: new Date(),
    updatedAt: new Date(),
}

describe('Event Template API', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAuth).mockReturnValue('user_123')
    })

    it('lists templates for the current user', async () => {
        vi.mocked(prisma.eventTemplate.findMany).mockResolvedValue([baseTemplate] as any)

        const res = await app.request('/api/event-templates')
        const body = await res.json() as any

        expect(res.status).toBe(200)
        expect(body.templates).toHaveLength(1)
        expect(body.templates[0].name).toBe('Weekly Standup')
        expect(prisma.eventTemplate.findMany).toHaveBeenCalledWith({
            where: { userId: 'user_123' },
            orderBy: { updatedAt: 'desc' },
        })
    })

    it('creates new templates with sanitized fields', async () => {
        vi.mocked(prisma.eventTemplate.create).mockResolvedValue(baseTemplate as any)

        const res = await app.request('/api/event-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: '<b>Weekly Standup</b>',
                description: 'Use weekly',
                data: baseTemplate.data,
            }),
        })

        expect(res.status).toBe(201)
        expect(prisma.eventTemplate.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user_123',
                name: 'Weekly Standup',
            }),
        })
    })

    it('retrieves template by id', async () => {
        vi.mocked(prisma.eventTemplate.findUnique).mockResolvedValue(baseTemplate as any)

        const res = await app.request(`/api/event-templates/${baseTemplate.id}`)
        const body = await res.json() as any

        expect(res.status).toBe(200)
        expect(body.id).toBe(baseTemplate.id)
    })

    it('returns 404 for missing template', async () => {
        vi.mocked(prisma.eventTemplate.findUnique).mockResolvedValue(null)

        const res = await app.request(`/api/event-templates/${baseTemplate.id}`)

        expect(res.status).toBe(404)
    })

    it('updates template data', async () => {
        vi.mocked(prisma.eventTemplate.findUnique).mockResolvedValue(baseTemplate as any)
        vi.mocked(prisma.eventTemplate.update).mockResolvedValue({
            ...baseTemplate,
            name: 'Updated Template',
        } as any)

        const res = await app.request(`/api/event-templates/${baseTemplate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Updated Template',
                data: baseTemplate.data,
            }),
        })
        const body = await res.json() as any

        expect(res.status).toBe(200)
        expect(body.name).toBe('Updated Template')
        expect(prisma.eventTemplate.update).toHaveBeenCalledWith({
            where: { id: baseTemplate.id },
            data: expect.objectContaining({
                name: 'Updated Template',
            }),
        })
    })

    it('deletes template by id', async () => {
        vi.mocked(prisma.eventTemplate.findUnique).mockResolvedValue(baseTemplate as any)
        vi.mocked(prisma.eventTemplate.delete).mockResolvedValue(baseTemplate as any)

        const res = await app.request(`/api/event-templates/${baseTemplate.id}`, {
            method: 'DELETE',
        })
        const body = await res.json() as any

        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        expect(prisma.eventTemplate.delete).toHaveBeenCalledWith({
            where: { id: baseTemplate.id },
        })
    })
})
