import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isUrlSafe } from '../../lib/ssrfProtection.js'

const { resolve4Mock, resolve6Mock } = vi.hoisted(() => ({
	resolve4Mock: vi.fn(),
	resolve6Mock: vi.fn(),
}))

vi.mock('dns/promises', () => ({
	resolve4: resolve4Mock,
	resolve6: resolve6Mock,
}))

describe('isUrlSafe DNS handling', () => {
	beforeEach(() => {
		resolve4Mock.mockReset()
		resolve6Mock.mockReset()
		process.env.NODE_ENV = 'test'
	})

	it('rejects URLs whose DNS does not resolve', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to private IPs via DNS', async () => {
		resolve4Mock.mockResolvedValue(['10.0.0.1'])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects when DNS module throws during resolution', async () => {
		resolve4Mock.mockImplementation(() => {
			throw new Error('dns failure')
		})

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('allows URLs resolving to public IPs via DNS', async () => {
		resolve4Mock.mockResolvedValue(['8.8.8.8'])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(true)
	})

	it('allows URLs resolving to public IPv6 via DNS', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['2001:4860:4860::8888'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(true)
	})

	it('rejects URLs resolving to private IPv6 via DNS', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['fc00::1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to IPv4-mapped loopback', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['::ffff:127.0.0.1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to IPv4-mapped private 10.x', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['::ffff:10.0.0.1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to IPv4-mapped private 172.x', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['::ffff:172.16.0.1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to IPv4-mapped private 192.168.x', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['::ffff:192.168.1.1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to link-local fe80', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['fe80::1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to fd00 unique local', async () => {
		resolve4Mock.mockResolvedValue([])
		resolve6Mock.mockResolvedValue(['fd00::1'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to 0.x network', async () => {
		resolve4Mock.mockResolvedValue(['0.0.0.1'])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('rejects URLs resolving to 169.254.x link-local', async () => {
		resolve4Mock.mockResolvedValue(['169.254.1.1'])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})

	it('handles IPv6 hostname with brackets in URL', async () => {
		process.env.NODE_ENV = 'production'
		await expect(isUrlSafe('http://[::1]:8080')).resolves.toBe(false)
	})

	it('skips DNS for .local domains in development', async () => {
		process.env.NODE_ENV = 'development'
		await expect(isUrlSafe('http://myhost.local')).resolves.toBe(true)
		expect(resolve4Mock).not.toHaveBeenCalled()
	})

	it('handles mixed IPv4 and IPv6 DNS results', async () => {
		resolve4Mock.mockResolvedValue(['8.8.8.8'])
		resolve6Mock.mockResolvedValue(['2001:4860:4860::8888'])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(true)
	})

	it('rejects if any resolved IP is private', async () => {
		resolve4Mock.mockResolvedValue(['8.8.8.8', '10.0.0.1'])
		resolve6Mock.mockResolvedValue([])

		await expect(isUrlSafe('https://example.com')).resolves.toBe(false)
	})
})
