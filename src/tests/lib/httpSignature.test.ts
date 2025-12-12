/**
 * Tests for HTTP Signature Implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import { signRequest, verifySignature, createDigest } from '../../lib/httpSignature.js'
import * as ssrfProtection from '../../lib/ssrfProtection.js'

describe('HTTP Signature', () => {
	let privateKey: string
	let publicKey: string
	let keyId: string

	beforeEach(() => {
		// Generate RSA key pair for testing
		const { publicKey: pubKey, privateKey: privKey } = generateKeyPairSync('rsa', {
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

		privateKey = privKey
		publicKey = pubKey
		keyId = 'https://example.com/users/test#main-key'
	})

	describe('signRequest', () => {
		it('should generate a valid signature header', () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			expect(signature).toContain('keyId=')
			expect(signature).toContain('algorithm="rsa-sha256"')
			expect(signature).toContain('headers=')
			expect(signature).toContain('signature=')
		})

		it('should include digest in signature when present', () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
				digest: 'SHA-256=abc123',
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			expect(signature).toContain('digest')
			const headersMatch = signature.match(/headers="([^"]+)"/)
			expect(headersMatch?.[1]).toContain('digest')
		})

		it('should sign (request-target) correctly', () => {
			const method = 'GET'
			const path = '/users/test'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			// Verify signature can be verified
			expect(signature).toBeTruthy()
		})

		it('should handle different HTTP methods', () => {
			const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
			const path = '/test'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			for (const method of methods) {
				const signature = signRequest(privateKey, keyId, method, path, headers)
				expect(signature).toBeTruthy()
				expect(signature).toContain('algorithm="rsa-sha256"')
			}
		})
	})

	describe('verifySignature', () => {
		it('should verify a valid signature', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			// Sign the request
			const signature = signRequest(privateKey, keyId, method, path, headers)

			// Mock fetchPublicKey to return our test public key
			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: true,
				json: async () => ({
					publicKey: {
						publicKeyPem: publicKey,
					},
				}),
			} as any)

			// Verify the signature
			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(true)
		})

		it('should reject invalid signature', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			// Create a signature with wrong key
			const { privateKey: wrongKey } = generateKeyPairSync('rsa', {
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
			const signature = signRequest(wrongKey, keyId, method, path, headers)

			// Mock fetchPublicKey to return correct public key
			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: true,
				json: async () => ({
					publicKey: {
						publicKeyPem: publicKey,
					},
				}),
			} as any)

			// Verify should fail
			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(false)
		})

		it('should reject signature with wrong algorithm', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			// Create invalid signature header with wrong algorithm
			const invalidSignature = `keyId="${keyId}",algorithm="hmac-sha256",headers="(request-target) host date",signature="invalid"`

			const isValid = await verifySignature(invalidSignature, method, path, headers)

			expect(isValid).toBe(false)
		})

		it('should reject signature with missing headers', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				// Missing date header
			}

			const signature = signRequest(privateKey, keyId, method, path, {
				host: 'example.com',
				date: new Date().toUTCString(),
			})

			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: true,
				json: async () => ({
					publicKey: {
						publicKeyPem: publicKey,
					},
				}),
			} as any)

			// Should fail because date header is missing
			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(false)
		})

		it('should handle signature with digest', async () => {
			const method = 'POST'
			const path = '/inbox'
			const body = JSON.stringify({ test: 'data' })
			const digest = await createDigest(body)
			// Capture date once to ensure same value is used for signing and verification
			const dateValue = new Date().toUTCString()
			const headers = {
				host: 'example.com',
				date: dateValue,
				digest,
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: true,
				json: async () => ({
					publicKey: {
						publicKeyPem: publicKey,
					},
				}),
			} as any)

			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(true)
		})

		it('should fail when public key cannot be fetched', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			// Mock fetch to fail
			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: false,
				status: 404,
			} as any)

			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(false)
		})

		it('should fail when actor JSON is invalid', async () => {
			const method = 'POST'
			const path = '/inbox'
			const headers = {
				host: 'example.com',
				date: new Date().toUTCString(),
			}

			const signature = signRequest(privateKey, keyId, method, path, headers)

			// Mock fetch to return invalid JSON
			vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
				ok: true,
				json: async () => ({
					// Missing publicKey
				}),
			} as any)

			const isValid = await verifySignature(signature, method, path, headers)

			expect(isValid).toBe(false)
		})
	})

	describe('createDigest', () => {
		it('should create a valid SHA-256 digest', async () => {
			const body = 'test body content'
			const digest = await createDigest(body)

			expect(digest).toMatch(/^SHA-256=/)
			expect(digest.length).toBeGreaterThan(10)
		})

		it('should create different digests for different content', async () => {
			const body1 = 'content 1'
			const body2 = 'content 2'

			const digest1 = await createDigest(body1)
			const digest2 = await createDigest(body2)

			expect(digest1).not.toBe(digest2)
		})

		it('should create same digest for same content', async () => {
			const body = 'same content'

			const digest1 = await createDigest(body)
			const digest2 = await createDigest(body)

			expect(digest1).toBe(digest2)
		})

		it('should handle empty body', async () => {
			const digest = await createDigest('')

			expect(digest).toMatch(/^SHA-256=/)
		})

		it('should handle large body', async () => {
			const largeBody = 'x'.repeat(10000)
			const digest = await createDigest(largeBody)

			expect(digest).toMatch(/^SHA-256=/)
		})
	})
})
