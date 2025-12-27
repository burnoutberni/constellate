import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveWebFinger } from '../../lib/webfinger.js'
import { safeFetch } from '../../lib/ssrfProtection.js'
import { ContentType } from '../../constants/activitypub.js'

// Mock dependencies
vi.mock('../../lib/ssrfProtection.js', () => ({
	safeFetch: vi.fn(),
}))

vi.mock('../../config.js', () => ({
	config: {
		baseUrl: 'http://localhost:3000',
	},
}))

describe('webfinger', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('resolveWebFinger', () => {
		it('should resolve a valid WebFinger resource', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					links: [
						{
							rel: 'self',
							type: ContentType.ACTIVITY_JSON,
							href: 'https://example.com/users/alice',
						},
					],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			const result = await resolveWebFinger('acct:alice@example.com')
			expect(result).toBe('https://example.com/users/alice')
			expect(safeFetch).toHaveBeenCalledWith(
				'https://example.com/.well-known/webfinger?resource=acct%3Aalice%40example.com',
				{
					headers: {
						Accept: ContentType.JSON,
					},
				}
			)
		})

		it('should return null for invalid resource format', async () => {
			const result = await resolveWebFinger('invalid-format')
			expect(result).toBeNull()
			expect(safeFetch).not.toHaveBeenCalled()
		})

		it('should return null when WebFinger request fails', async () => {
			const mockResponse = {
				ok: false,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			const result = await resolveWebFinger('acct:alice@example.com')
			expect(result).toBeNull()
		})

		it('should return null when no ActivityPub link found', async () => {
			const mockResponse = {
				ok: true,
				json: async () => ({
					links: [
						{
							rel: 'alternate',
							type: 'text/html',
							href: 'https://example.com/users/alice',
						},
					],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			const result = await resolveWebFinger('acct:alice@example.com')
			expect(result).toBeNull()
		})

		it('should use http for .local domains in development', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			const mockResponse = {
				ok: true,
				json: async () => ({
					links: [
						{
							rel: 'self',
							type: ContentType.ACTIVITY_JSON,
							href: 'http://app2.local/users/bob',
						},
					],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			await resolveWebFinger('acct:bob@app2.local')
			expect(safeFetch).toHaveBeenCalledWith(
				expect.stringContaining('http://app2.local'),
				expect.any(Object)
			)

			process.env.NODE_ENV = originalEnv
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

			const result = await resolveWebFinger('acct:alice@example.com')
			expect(result).toBeNull()
		})
	})
})
