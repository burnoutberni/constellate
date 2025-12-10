/**
 * Event Template Management
 * Save and reuse event configurations
 */

import { Hono, type Context } from 'hono'
import { ZodError } from 'zod'
import type { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { requireAuth } from './middleware/auth.js'
import { sanitizeText } from './lib/sanitization.js'
import { AppError, Errors } from './lib/errors.js'
import {
    EventTemplateInputSchema,
    EventTemplateDataSchema,
    EventTemplateListSchema,
    EventTemplateUpdateSchema,
} from './lib/apiSchemas.js'

const app = new Hono()

const TemplateInput = EventTemplateInputSchema
const TemplateUpdate = EventTemplateUpdateSchema

type TemplateData = z.infer<typeof EventTemplateDataSchema>

function sanitizeTemplateData(data: Partial<TemplateData>): Prisma.InputJsonValue {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data) as [keyof TemplateData, TemplateData[keyof TemplateData]][]) {
        if (value === undefined || value === null) {
            continue
        }

        if (typeof value === 'string') {
            sanitized[key] = sanitizeText(value)
        } else {
            sanitized[key] = value
        }
    }
    return sanitized as Prisma.InputJsonValue
}

function serializeTemplate(template: { id: string; createdAt: Date; updatedAt: Date }): Record<string, unknown> {
    return {
        ...template,
        updatedAt: template.updatedAt.toISOString(),
        createdAt: template.createdAt.toISOString(),
    }
}

function respondWithAppError(error: AppError, c: Context) {
    return c.json({
        error: error.code,
        message: error.message,
    }, error.statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500)
}

app.get('/event-templates', async (c) => {
    try {
        const userId = requireAuth(c)

        const templates = await prisma.eventTemplate.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
        })

        const response = EventTemplateListSchema.parse({
            templates: templates.map((template) => serializeTemplate(template)),
        })

        return c.json(response)
    } catch (error) {
        console.error('Error listing event templates:', error)
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        if (error instanceof AppError) {
            return respondWithAppError(error, c)
        }
        return c.json({ error: 'Internal server error' }, 500 as const)
    }
})

app.post('/event-templates', async (c) => {
    try {
        const userId = requireAuth(c)
        const payload = TemplateInput.parse(await c.req.json())

        const template = await prisma.eventTemplate.create({
            data: {
                userId,
                name: sanitizeText(payload.name),
                description: payload.description ? sanitizeText(payload.description) : null,
                data: sanitizeTemplateData(payload.data),
            },
        })

        return c.json(serializeTemplate(template), 201 as const)
    } catch (error) {
        console.error('Error creating event template:', error)
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }

        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return c.json({ error: 'Template name already exists' }, 409 as const)
        }

        if (error instanceof AppError) {
            return respondWithAppError(error, c)
        }

        return c.json({ error: 'Internal server error' }, 500 as const)
    }
})

app.get('/event-templates/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const template = await prisma.eventTemplate.findUnique({
            where: { id },
        })

        if (!template || template.userId !== userId) {
            throw Errors.notFound('Event template')
        }

        return c.json(serializeTemplate(template))
    } catch (error) {
        console.error('Error fetching event template:', error)
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        if (error instanceof AppError) {
            return respondWithAppError(error, c)
        }
        return c.json({ error: 'Internal server error' }, 500 as const)
    }
})

app.put('/event-templates/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)
        const payload = TemplateUpdate.parse(await c.req.json())

        const template = await getOwnedTemplate(id, userId)
        const updateData = buildTemplateUpdateData(payload, template)

        const updated = await prisma.eventTemplate.update({
            where: { id },
            data: updateData,
        })

        return c.json(serializeTemplate(updated))
    } catch (error) {
        console.error('Error updating event template:', error)
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return c.json({ error: 'Template name already exists' }, 409 as const)
        }
        if (error instanceof AppError) {
            return respondWithAppError(error, c)
        }
        return c.json({ error: 'Internal server error' }, 500 as const)
    }
})

type TemplateRecord = {
    id: string
    userId: string
    data: Prisma.JsonValue | null
}

async function getOwnedTemplate(id: string, userId: string): Promise<TemplateRecord> {
    const template = await prisma.eventTemplate.findUnique({
        where: { id },
    })

    if (!template || template.userId !== userId) {
        throw Errors.notFound('Event template')
    }

    return template
}

function buildTemplateUpdateData(payload: z.infer<typeof TemplateUpdate>, template: TemplateRecord): Record<string, unknown> {
    const updateData: Record<string, unknown> = {}

    if (payload.name) {
        updateData.name = sanitizeText(payload.name)
    }

    if (payload.description !== undefined) {
        updateData.description = payload.description ? sanitizeText(payload.description) : null
    }

    if (payload.data) {
        updateData.data = mergeTemplateData(payload.data, template.data)
    }

    return updateData
}

function mergeTemplateData(newData: Partial<TemplateData>, existingData: Prisma.JsonValue | null) {
    const currentData =
        existingData && typeof existingData === 'object' && !Array.isArray(existingData)
            ? (existingData as Record<string, unknown>)
            : {}
    const sanitizedData = sanitizeTemplateData(newData)
    const mergedData: Record<string, unknown> = {
        ...currentData,
        ...(sanitizedData as Record<string, unknown>),
    }
    return mergedData as Prisma.InputJsonValue
}

app.delete('/event-templates/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const template = await prisma.eventTemplate.findUnique({
            where: { id },
        })

        if (!template || template.userId !== userId) {
            throw Errors.notFound('Event template')
        }

        await prisma.eventTemplate.delete({
            where: { id },
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting event template:', error)
        if (error instanceof AppError) {
            return respondWithAppError(error, c)
        }
        return c.json({ error: 'Internal server error' }, 500 as const)
    }
})

export default app
