import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import templatesApp from '../templates.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

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
		// Create template in the mock database
		await prisma.eventTemplate.create({
			data: baseTemplate,
		})

		const res = await app.request('/api/event-templates')
		const body = (await res.json()) as any

		expect(res.status).toBe(200)
		expect(body.templates).toHaveLength(1)
		expect(body.templates[0].name).toBe('Weekly Standup')
	})

	it('creates new templates with sanitized fields', async () => {
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
		const body = (await res.json()) as any
		expect(body.name).toBe('Weekly Standup') // Should be sanitized
		
		// Verify it was created in the database
		const templates = await prisma.eventTemplate.findMany({
			where: { userId: 'user_123' },
		})
		expect(templates).toHaveLength(1)
		expect(templates[0].name).toBe('Weekly Standup')
	})

	it('returns 401 when authentication fails', async () => {
		vi.mocked(requireAuth).mockImplementation(() => {
			throw new AppError('UNAUTHORIZED', 'Authentication required', 401)
		})

		const res = await app.request('/api/event-templates')

		expect(res.status).toBe(401)
	})

	it('responds with conflict when template name already exists', async () => {
		// Create a template with the same name first
		await prisma.eventTemplate.create({
			data: baseTemplate,
		})

		const res = await app.request('/api/event-templates', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Weekly Standup',
				data: baseTemplate.data,
			}),
		})

		expect(res.status).toBe(409)
	})

	it('validates template payloads', async () => {
		const res = await app.request('/api/event-templates', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: '',
				data: {},
			}),
		})

		expect(res.status).toBe(400)
	})

	it('retrieves template by id', async () => {
		// Create template in the mock database
		await prisma.eventTemplate.create({
			data: baseTemplate,
		})

		const res = await app.request(`/api/event-templates/${baseTemplate.id}`)
		const body = (await res.json()) as any

		expect(res.status).toBe(200)
		expect(body.id).toBe(baseTemplate.id)
	})

	it('returns 404 for missing template', async () => {
		const res = await app.request(`/api/event-templates/non-existent-id`)

		expect(res.status).toBe(404)
	})

	it('updates template data', async () => {
		// Create template in the mock database
		const created = await prisma.eventTemplate.create({
			data: baseTemplate,
		})

		const res = await app.request(`/api/event-templates/${created.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Updated Template',
				data: baseTemplate.data,
			}),
		})
		const body = (await res.json()) as any

		expect(res.status).toBe(200)
		expect(body.name).toBe('Updated Template')
		
		// Verify it was updated in the database
		const updated = await prisma.eventTemplate.findUnique({
			where: { id: created.id },
		})
		expect(updated?.name).toBe('Updated Template')
	})

	it('merges existing template data when partial payload provided', async () => {
		const existingTemplate = {
			...baseTemplate,
			data: {
				title: 'Original',
				summary: 'Keep me',
				location: 'Room 1',
			},
		}

		// Create template in the mock database
		const created = await prisma.eventTemplate.create({
			data: existingTemplate,
		})

		const res = await app.request(`/api/event-templates/${created.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				data: {
					title: '<b>Updated</b>',
				},
			}),
		})

		expect(res.status).toBe(200)
		const body = (await res.json()) as any
		expect(body.data.title).toBe('Updated') // Should be sanitized
		expect(body.data.summary).toBe('Keep me') // Should be preserved
		expect(body.data.location).toBe('Room 1') // Should be preserved
	})

	it('returns 404 when updating template from another user', async () => {
		// Create template with different user
		const created = await prisma.eventTemplate.create({
			data: {
				...baseTemplate,
				userId: 'other_user',
			},
		})

		const res = await app.request(`/api/event-templates/${created.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Updated Template',
			}),
		})

		expect(res.status).toBe(404)
	})

	it('deletes template by id', async () => {
		// Create template in the mock database
		const created = await prisma.eventTemplate.create({
			data: baseTemplate,
		})

		const res = await app.request(`/api/event-templates/${created.id}`, {
			method: 'DELETE',
		})
		const body = (await res.json()) as any

		expect(res.status).toBe(200)
		expect(body.success).toBe(true)
		
		// Verify it was deleted from the database
		const deleted = await prisma.eventTemplate.findUnique({
			where: { id: created.id },
		})
		expect(deleted).toBeNull()
	})

	it('returns 404 when deleting template from another user', async () => {
		// Create template with different user
		const created = await prisma.eventTemplate.create({
			data: {
				...baseTemplate,
				userId: 'other_user',
			},
		})

		const res = await app.request(`/api/event-templates/${created.id}`, {
			method: 'DELETE',
		})

		expect(res.status).toBe(404)
	})
})
