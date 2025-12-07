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
})

