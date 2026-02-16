
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import activitypubApp from '../activitypub.js'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { signRequest } from '../lib/httpSignature.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
		},
	},
}))

vi.mock('../federation.js', () => ({
	handleActivity: vi.fn().mockResolvedValue(undefined),
}))

// Mock ssrfProtection to return our public key
vi.mock('../lib/ssrfProtection.js', () => ({
	safeFetch: vi.fn(),
	isUrlSafe: vi.fn().mockResolvedValue(true),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

// Import mocked modules to control them
import { prisma } from '../lib/prisma.js'
import { safeFetch } from '../lib/ssrfProtection.js'

describe('Digest Verification Vulnerability', () => {
	let app: Hono
	let privateKey: string
	let publicKey: string
	const keyId = 'https://remote.com/users/attacker#main-key'
	const actorUrl = 'https://remote.com/users/attacker'

	beforeEach(() => {
		vi.clearAllMocks()
		app = new Hono()
		app.route('/', activitypubApp)

		// Generate keys
		const keys = generateKeyPairSync('rsa', {
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
		privateKey = keys.privateKey
		publicKey = keys.publicKey

		// Mock local user (alice) exists
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			id: 'user_123',
			username: 'alice',
			isRemote: false,
		} as any)

		// Mock fetching the remote actor's public key
		vi.mocked(safeFetch).mockImplementation(async (url) => {
			if (url === actorUrl) {
				return {
					ok: true,
					json: async () => ({
						publicKey: {
							publicKeyPem: publicKey,
						},
					}),
				} as Response
			}
			return { ok: false } as Response
		})
	})

	it('should reject a request with a valid signature but a modified body', async () => {
		const validBody = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://remote.com/activities/1',
			type: 'Follow',
			actor: actorUrl,
			object: 'http://localhost:3000/users/alice',
		}
		const validBodyString = JSON.stringify(validBody)

		// Calculate valid Digest
		const hash = createHash('sha256').update(validBodyString).digest('base64')
		const digestHeader = `SHA-256=${hash}`

		// Create headers for signature
		const date = new Date().toUTCString()
		const headers = {
			host: 'localhost:3000',
			date,
			digest: digestHeader,
			'(request-target)': 'post /users/alice/inbox',
			'content-type': 'application/activity+json',
		}

		// Sign the request (using the valid body's digest)
		const signature = signRequest(privateKey, keyId, 'POST', '/users/alice/inbox', headers)

		// Create MALICIOUS body (different content, same ID/Actor)
		const maliciousBody = {
			...validBody,
			type: 'Create', // Changed type!
			object: {
				type: 'Note',
				content: 'This is a malicious message injected via body swapping!',
			},
		}

		// Note: We are sending maliciousBody, but using the signature/digest of validBody
		// The server should now reject this because the Digest header doesn't match the body.

		const res = await app.request('/users/alice/inbox', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/activity+json',
				host: 'localhost:3000',
				date,
				digest: digestHeader, // Valid digest for the ORIGINAL body
				signature,
			},
			body: JSON.stringify(maliciousBody), // Sending the MALICIOUS body
		})

		// Should return 401 Unauthorized (Digest mismatch)
		expect(res.status).toBe(401)
		const body = await res.json()
		expect(body).toEqual({ error: 'Digest mismatch' })
	})
})
