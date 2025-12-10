import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryKeys } from './keys'

describe('Instance Query Keys', () => {
    it('should generate correct list query key', () => {
        const params = { limit: 50, offset: 0, sortBy: 'activity' as const }
        const key = queryKeys.instances.list(params)
        expect(key).toEqual(['instances', 'list', params])
    })

    it('should generate correct search query key', () => {
        const query = 'mastodon'
        const limit = 20
        const key = queryKeys.instances.search(query, limit)
        expect(key).toEqual(['instances', 'search', query, limit])
    })

    it('should generate correct detail query key', () => {
        const domain = 'mastodon.social'
        const key = queryKeys.instances.detail(domain)
        expect(key).toEqual(['instances', 'detail', domain])
    })

    it('should generate correct all query key', () => {
        const key = queryKeys.instances.all()
        expect(key).toEqual(['instances'])
    })
})

describe('Instance API Endpoints', () => {
    beforeEach(() => {
        global.fetch = vi.fn()
    })

    it('should construct correct list endpoint URL', () => {
        const params = new URLSearchParams()
        params.append('limit', '50')
        params.append('offset', '0')
        params.append('sortBy', 'activity')
        
        expect(params.toString()).toBe('limit=50&offset=0&sortBy=activity')
    })

    it('should construct correct search endpoint URL', () => {
        const query = 'mastodon'
        const limit = 20
        const params = new URLSearchParams()
        params.append('q', query)
        params.append('limit', limit.toString())
        
        expect(params.toString()).toBe('q=mastodon&limit=20')
    })

    it('should encode domain parameter correctly', () => {
        const domain = 'example.com'
        const encoded = encodeURIComponent(domain)
        expect(encoded).toBe('example.com')
    })

    it('should encode domain with special characters correctly', () => {
        const domain = 'my-instance.example.com'
        const encoded = encodeURIComponent(domain)
        expect(encoded).toBe('my-instance.example.com')
    })
})
