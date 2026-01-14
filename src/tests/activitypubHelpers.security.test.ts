/**
 * Security Tests for ActivityPub Helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { cacheRemoteUser, extractLocationValue } from '../lib/activitypubHelpers.js'
import { prisma } from '../lib/prisma.js'

// Mock trackInstance to avoid side effects
vi.mock('../lib/instanceHelpers.js', () => ({
    trackInstance: vi.fn().mockResolvedValue(undefined)
}))

describe('ActivityPub Helpers Security', () => {
    beforeEach(async () => {
        await prisma.user.deleteMany({})
        await prisma.event.deleteMany({})
    })

    it('should sanitize user fields in cacheRemoteUser', async () => {
        const xssPayload = '<script>alert(1)</script>'
        const safeName = 'Safe Name'

        const actor = {
            id: 'https://example.com/users/attacker-helper',
            type: 'Person',
            preferredUsername: 'attacker-helper',
            name: `${safeName}${xssPayload}`,
            summary: `Bio${xssPayload}`,
            inbox: 'https://example.com/inbox',
            publicKey: { publicKeyPem: 'key' }
        }

        const user = await cacheRemoteUser(actor as any)

        expect(user.name).toBe(safeName)
        expect(user.bio).toBe('Bio')
    })

    it('should sanitize location in extractLocationValue', () => {
         const xssPayload = '<img src=x onerror=alert(1)>'

         const loc1 = `New York${xssPayload}`
         expect(extractLocationValue(loc1)).toBe('New York')

         const loc2 = { name: `London${xssPayload}` }
         expect(extractLocationValue(loc2)).toBe('London')
    })
})
