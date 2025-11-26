/**
 * Tests for SSRF Protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isUrlSafe, safeFetch } from '../../lib/ssrfProtection.js'

describe('SSRF Protection', () => {
    const originalEnv = process.env.NODE_ENV

    beforeEach(() => {
        // Reset environment
        process.env.NODE_ENV = originalEnv
    })

    describe('isUrlSafe', () => {
        it('should allow valid HTTPS URLs', () => {
            expect(isUrlSafe('https://example.com')).toBe(true)
            expect(isUrlSafe('https://example.com/path')).toBe(true)
            expect(isUrlSafe('https://example.com:443/path')).toBe(true)
        })

        it('should allow valid HTTP URLs', () => {
            expect(isUrlSafe('http://example.com')).toBe(true)
            expect(isUrlSafe('http://example.com/path')).toBe(true)
        })

        it('should reject invalid protocols', () => {
            expect(isUrlSafe('ftp://example.com')).toBe(false)
            expect(isUrlSafe('file:///etc/passwd')).toBe(false)
            expect(isUrlSafe('javascript:alert(1)')).toBe(false)
            expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false)
        })

        it('should reject private IP addresses', () => {
            expect(isUrlSafe('http://127.0.0.1')).toBe(false)
            expect(isUrlSafe('http://127.0.0.1:3000')).toBe(false)
            expect(isUrlSafe('http://10.0.0.1')).toBe(false)
            expect(isUrlSafe('http://172.16.0.1')).toBe(false)
            expect(isUrlSafe('http://192.168.1.1')).toBe(false)
            expect(isUrlSafe('http://169.254.1.1')).toBe(false)
        })

        it('should reject localhost in production', () => {
            process.env.NODE_ENV = 'production'
            expect(isUrlSafe('http://localhost')).toBe(false)
            expect(isUrlSafe('http://localhost:3000')).toBe(false)
            expect(isUrlSafe('http://test.local')).toBe(false)
        })

        it('should allow localhost in development', () => {
            process.env.NODE_ENV = 'development'
            expect(isUrlSafe('http://localhost')).toBe(true)
            expect(isUrlSafe('http://localhost:3000')).toBe(true)
            expect(isUrlSafe('http://test.local')).toBe(true)
            expect(isUrlSafe('http://127.0.0.1')).toBe(true)
        })

        it('should reject IPv6 loopback', () => {
            expect(isUrlSafe('http://[::1]')).toBe(false)
            expect(isUrlSafe('http://[::1]:3000')).toBe(false)
        })

        it('should reject IPv6 link-local', () => {
            expect(isUrlSafe('http://[fe80::1]')).toBe(false)
            expect(isUrlSafe('http://[fc00::1]')).toBe(false)
            expect(isUrlSafe('http://[fd00::1]')).toBe(false)
        })

        it('should reject invalid URLs', () => {
            expect(isUrlSafe('not-a-url')).toBe(false)
            expect(isUrlSafe('')).toBe(false)
            expect(isUrlSafe('://example.com')).toBe(false)
        })

        it('should handle URLs with query parameters', () => {
            expect(isUrlSafe('https://example.com?param=value')).toBe(true)
            expect(isUrlSafe('https://example.com/path?param=value&other=test')).toBe(true)
        })

        it('should handle URLs with fragments', () => {
            expect(isUrlSafe('https://example.com#fragment')).toBe(true)
            expect(isUrlSafe('https://example.com/path#section')).toBe(true)
        })

        it('should handle URLs with ports', () => {
            expect(isUrlSafe('https://example.com:443')).toBe(true)
            expect(isUrlSafe('https://example.com:8080')).toBe(true)
        })

        it('should reject URLs with private IP ranges in hostname', () => {
            expect(isUrlSafe('http://10.1.1.1')).toBe(false)
            expect(isUrlSafe('http://192.168.0.1')).toBe(false)
            expect(isUrlSafe('http://172.20.0.1')).toBe(false)
        })
    })

    describe('safeFetch', () => {
        it('should fetch safe URLs successfully', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({ test: 'data' }),
            }

            global.fetch = vi.fn().mockResolvedValue(mockResponse)

            const response = await safeFetch('https://example.com')

            expect(response).toBe(mockResponse)
            expect(global.fetch).toHaveBeenCalledWith('https://example.com', expect.any(Object))
        })

        it('should reject unsafe URLs', async () => {
            await expect(safeFetch('http://127.0.0.1')).rejects.toThrow('URL is not safe to fetch')
            await expect(safeFetch('ftp://example.com')).rejects.toThrow('URL is not safe to fetch')
        })

        it('should timeout after specified duration', async () => {
            // Mock fetch to never resolve
            global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))

            await expect(
                safeFetch('https://example.com', {}, 100) // 100ms timeout
            ).rejects.toThrow(/Request timeout/)

            // Clean up
            vi.clearAllTimers()
        })

        it('should pass fetch options correctly', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({}),
            }

            global.fetch = vi.fn().mockResolvedValue(mockResponse)

            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ test: 'data' }),
            }

            await safeFetch('https://example.com', options)

            expect(global.fetch).toHaveBeenCalledWith(
                'https://example.com',
                expect.objectContaining({
                    method: 'POST',
                    headers: options.headers,
                    body: options.body,
                    signal: expect.any(AbortSignal),
                })
            )
        })

        it('should handle fetch errors', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

            await expect(safeFetch('https://example.com')).rejects.toThrow('Network error')
        })

        it('should use default timeout of 30 seconds', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({}),
            }

            global.fetch = vi.fn().mockResolvedValue(mockResponse)

            await safeFetch('https://example.com')

            // Verify AbortSignal was created (timeout would be set)
            expect(global.fetch).toHaveBeenCalledWith(
                'https://example.com',
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                })
            )
        })

        it('should allow custom timeout', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({}),
            }

            global.fetch = vi.fn().mockResolvedValue(mockResponse)

            await safeFetch('https://example.com', {}, 5000) // 5 second timeout

            expect(global.fetch).toHaveBeenCalled()
        })

        it('should clear timeout on successful fetch', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({}),
            }

            global.fetch = vi.fn().mockResolvedValue(mockResponse)

            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

            await safeFetch('https://example.com', {}, 1000)

            // Timeout should be cleared after successful fetch
            expect(clearTimeoutSpy).toHaveBeenCalled()
        })

        it('should clear timeout on fetch error', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

            await expect(safeFetch('https://example.com', {}, 1000)).rejects.toThrow()

            // Timeout should be cleared even on error
            expect(clearTimeoutSpy).toHaveBeenCalled()
        })
    })
})

