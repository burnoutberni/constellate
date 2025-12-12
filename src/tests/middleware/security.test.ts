/**
 * Tests for Security Headers Middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context, Next } from 'hono'
import { securityHeaders } from '../../middleware/security.js'
import * as configModule from '../../config.js'

describe('Security Headers Middleware', () => {
	let mockContext: Context
	let mockNext: Next
	let mockHeader: ReturnType<typeof vi.fn>

	beforeEach(() => {
		mockHeader = vi.fn()
		mockNext = vi.fn().mockResolvedValue(undefined)

		mockContext = {
			header: mockHeader,
			req: {} as any,
			res: {} as any,
		} as unknown as Context
	})

	describe('Security Headers', () => {
		it('should set Content-Security-Policy header', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith(
				'Content-Security-Policy',
				expect.stringContaining("default-src 'self'")
			)
		})

		it('should set X-Frame-Options header to DENY', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
		})

		it('should set X-Content-Type-Options header to nosniff', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
		})

		it('should set X-XSS-Protection header', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
		})

		it('should set Referrer-Policy header', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith(
				'Referrer-Policy',
				'strict-origin-when-cross-origin'
			)
		})

		it('should set Permissions-Policy header', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith(
				'Permissions-Policy',
				'geolocation=(), microphone=(), camera=()'
			)
		})

		it('should remove X-Powered-By header', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith('X-Powered-By', '')
		})

		it('should call next() middleware', async () => {
			await securityHeaders(mockContext, mockNext)

			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should set headers after next() is called', async () => {
			let nextCalled = false
			mockNext = vi.fn().mockImplementation(async () => {
				nextCalled = true
			})

			await securityHeaders(mockContext, mockNext)

			expect(nextCalled).toBe(true)
			expect(mockHeader).toHaveBeenCalled()
		})
	})

	describe('Content Security Policy', () => {
		it('should include default-src in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("default-src 'self'")
		})

		it('should include script-src in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
		})

		it('should include style-src in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("style-src 'self' 'unsafe-inline'")
		})

		it('should include img-src in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("img-src 'self' data: https:")
		})

		it('should include connect-src in CSP for ActivityPub', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("connect-src 'self' https: wss: ws:")
		})

		it('should include frame-ancestors in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("frame-ancestors 'none'")
		})

		it('should include base-uri in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("base-uri 'self'")
		})

		it('should include form-action in CSP', async () => {
			await securityHeaders(mockContext, mockNext)

			const cspCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Content-Security-Policy'
			)
			expect(cspCall?.[1]).toContain("form-action 'self'")
		})
	})

	describe('HSTS Header', () => {
		it('should set Strict-Transport-Security in production', async () => {
			vi.spyOn(configModule, 'config', 'get').mockReturnValue({
				isProduction: true,
			} as any)

			await securityHeaders(mockContext, mockNext)

			expect(mockHeader).toHaveBeenCalledWith(
				'Strict-Transport-Security',
				'max-age=31536000; includeSubDomains; preload'
			)
		})

		it('should not set Strict-Transport-Security in development', async () => {
			vi.spyOn(configModule, 'config', 'get').mockReturnValue({
				isProduction: false,
			} as any)

			await securityHeaders(mockContext, mockNext)

			const hstsCall = mockHeader.mock.calls.find(
				(call) => call[0] === 'Strict-Transport-Security'
			)
			expect(hstsCall).toBeUndefined()
		})
	})

	describe('Header Order', () => {
		it('should set all required headers', async () => {
			await securityHeaders(mockContext, mockNext)

			const headerNames = mockHeader.mock.calls.map((call) => call[0])

			expect(headerNames).toContain('Content-Security-Policy')
			expect(headerNames).toContain('X-Frame-Options')
			expect(headerNames).toContain('X-Content-Type-Options')
			expect(headerNames).toContain('X-XSS-Protection')
			expect(headerNames).toContain('Referrer-Policy')
			expect(headerNames).toContain('Permissions-Policy')
			expect(headerNames).toContain('X-Powered-By')
		})

		it('should set exactly 7 headers in development', async () => {
			vi.spyOn(configModule, 'config', 'get').mockReturnValue({
				isProduction: false,
			} as any)

			await securityHeaders(mockContext, mockNext)

			const headerNames = mockHeader.mock.calls.map((call) => call[0])
			const uniqueHeaders = new Set(headerNames)
			expect(uniqueHeaders.size).toBe(7)
		})

		it('should set exactly 8 headers in production (including HSTS)', async () => {
			vi.spyOn(configModule, 'config', 'get').mockReturnValue({
				isProduction: true,
			} as any)

			await securityHeaders(mockContext, mockNext)

			const headerNames = mockHeader.mock.calls.map((call) => call[0])
			const uniqueHeaders = new Set(headerNames)
			expect(uniqueHeaders.size).toBe(8)
			expect(uniqueHeaders).toContain('Strict-Transport-Security')
		})
	})
})
