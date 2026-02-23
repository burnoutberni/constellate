import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import activitypubApp from '../activitypub.js'
import { handleActivity } from '../federation.js'
import crypto from 'crypto'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
		},
		processedActivity: {
			create: vi.fn(),
		},
	},
}))

// Mock verifySignature to always return true (simulating valid header signature)
vi.mock('../lib/httpSignature.js', async () => {
	const actual = await vi.importActual('../lib/httpSignature.js')
	return {
		...actual, // Keep createDigest and others
		verifySignature: vi.fn().mockResolvedValue(true),
	}
})

vi.mock('../federation.js', () => ({
	handleActivity: vi.fn(),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
	createOrderedCollection: vi.fn(),
	createOrderedCollectionPage: vi.fn(),
}))

vi.mock('../config.js', () => ({
	config: {
		isDevelopment: false,
	},
}))

const app = new Hono()
app.route('/', activitypubApp)

describe('Security: Digest Verification', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Ensure handleActivity returns a Promise to avoid 500 error
		// @ts-ignore
		handleActivity.mockResolvedValue(undefined)
	})

	it('should reject request when body does not match Digest header', async () => {
		const bodyA = JSON.stringify({
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://example.com/1',
			type: 'Follow',
			actor: 'https://example.com/users/alice',
			object: 'https://example.com/users/bob',
		})

		const bodyB = JSON.stringify({
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://example.com/1',
			type: 'Create', // Maliciously changed type
			actor: 'https://example.com/users/alice',
			object: { type: 'Note', content: 'Spam' },
		})

		// Calculate digest for Body A
		const hash = crypto.createHash('sha256').update(bodyA).digest('base64')
		const digestA = `SHA-256=${hash}`

		const res = await app.request('/inbox', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/activity+json',
				Digest: digestA, // Claiming to be Body A
				Signature:
					'keyId="...",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="..."',
				Date: new Date().toISOString(),
				Host: 'localhost:3000',
			},
			body: bodyB, // Sending Body B
		})

		// If vulnerable, it returns 202 Accepted
		// We want it to return 401 Unauthorized or 400 Bad Request
		if (res.status === 202) {
			console.log('VULNERABILITY CONFIRMED: Accepted mismatched digest')
		}
		expect(res.status).not.toBe(202)
		expect(res.status).toBe(400)
		const json = (await res.json()) as { error: string }
		expect(json.error).toBe('Invalid Digest')
	})

	it('should accept request when body matches Digest header', async () => {
		const body = JSON.stringify({
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://example.com/1',
			type: 'Follow',
			actor: 'https://example.com/users/alice',
			object: 'https://example.com/users/bob',
		})

		// Calculate valid digest
		const hash = crypto.createHash('sha256').update(body).digest('base64')
		const digest = `SHA-256=${hash}`

		const res = await app.request('/inbox', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/activity+json',
				Digest: digest,
				Signature:
					'keyId="...",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="..."',
				Date: new Date().toISOString(),
				Host: 'localhost:3000',
			},
			body: body,
		})

		expect(res.status).toBe(202)
		const json = (await res.json()) as { status: string }
		expect(json.status).toBe('accepted')
		expect(handleActivity).toHaveBeenCalled()
	})
})
