import { describe, it, expect, vi } from 'vitest'
import type { TestSentMessageInfo } from './TestSentMessageInfo'

// Import after mocks
const { sendNotificationEmail } = await import('../../lib/email.js')

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(async ({ where }) => {
				// Simulate a user with email and username
				if (where.id === 'user1') {
					return {
						email: 'user1@example.com',
						name: 'User One',
						username: 'userone',
						emailNotifications: { FOLLOW: true },
					}
				}
				return null
			}),
		},
		emailDelivery: { create: vi.fn() },
	},
}))

vi.mock('../../config.js', () => ({
	config: {
		baseUrl: 'https://example.com',
		smtp: {
			host: 'smtp.example.com',
			port: 587,
			secure: false,
			user: 'test@example.com',
			pass: 'password',
			from: 'noreply@example.com',
		},
	},
}))

vi.mock('nodemailer', () => ({
	createTransport: vi.fn(() => ({
		sendMail: vi
			.fn()
			.mockImplementation((opts) => Promise.resolve({ messageId: 'msgid', html: opts.html })),
	})),
}))

// Do not mock NotificationEmailTemplate, use the real template for HTML output

// Silence console logs
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

describe('sendNotificationEmail URL handling', () => {
	it('prepends baseUrl to relative contextUrl and actorUrl', async () => {
		const result = await sendNotificationEmail({
			userId: 'user1',
			type: 'FOLLOW',
			title: 'Test',
			contextUrl: '/profile/user1',
			actorUrl: '/profile/actor',
		})
		expect(result).toBeDefined()
		const html = (result as unknown as TestSentMessageInfo).html
		expect(html).toContain('https://example.com/profile/user1')
		expect(html).toContain('https://example.com/profile/actor')
	})

	it('does not modify already absolute URLs', async () => {
		const result = await sendNotificationEmail({
			userId: 'user1',
			type: 'FOLLOW',
			title: 'Test',
			contextUrl: 'https://external.com/page',
			actorUrl: 'http://external.com/actor',
		})
		expect(result).toBeDefined()
		const html = (result as unknown as TestSentMessageInfo).html
		expect(html).toContain('https://external.com/page')
		expect(html).toContain('http://external.com/actor')
	})

	it('returns no context/actor links for missing URLs', async () => {
		const result = await sendNotificationEmail({
			userId: 'user1',
			type: 'FOLLOW',
			title: 'Test',
		})
		expect(result).toBeDefined()
		const html = (result as unknown as TestSentMessageInfo).html
		// Should not contain a link to /profile/user1 or /profile/actor
		expect(html).not.toContain('/profile/user1')
		expect(html).not.toContain('/profile/actor')
	})
})
