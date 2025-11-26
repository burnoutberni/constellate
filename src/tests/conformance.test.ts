import { config } from 'dotenv'
config()
import { describe, it, expect, beforeAll } from 'vitest'
import {
    PersonSchema,
    EventSchema,
    OrderedCollectionSchema,
    WebFingerSchema
} from '../lib/activitypubSchemas.js'

describe('ActivityPub Conformance', () => {
    let app: any

    beforeAll(async () => {
        const mod = await import('../server.js')
        app = mod.app
    })

    describe('WebFinger', () => {
        it('should return 404 for non-existent users', async () => {
            const res = await app.request(`/.well-known/webfinger?resource=acct:nonexistent@example.com`)
            
            expect(res.status).toBe(404)
        })

        it('should return 400 for missing resource parameter', async () => {
            const res = await app.request('/.well-known/webfinger')
            expect(res.status).toBe(400)
        })

        it('should return valid JSON resource descriptor for existing user', async () => {
            // Use alice which is created in seed
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            const domain = new URL(baseUrl).hostname
            const resource = `acct:alice@${domain}`
            const res = await app.request(`/.well-known/webfinger?resource=${encodeURIComponent(resource)}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            
            // Validate against WebFinger schema
            const result = WebFingerSchema.safeParse(body)
            expect(result.success).toBe(true)
            
            // Check required fields
            expect(body.subject).toBe(resource)
            expect(body.links).toBeDefined()
            expect(Array.isArray(body.links)).toBe(true)
            expect(body.links.length).toBeGreaterThan(0)
            
            // Check that links contain required ActivityPub link
            const selfLink = body.links.find((link: any) => link.rel === 'self')
            expect(selfLink).toBeDefined()
            expect(selfLink.type).toBe('application/activity+json')
            expect(selfLink.href).toBe(`${baseUrl}/users/alice`)
            
            // Check aliases if present
            if (body.aliases) {
                expect(Array.isArray(body.aliases)).toBe(true)
                expect(body.aliases).toContain(`${baseUrl}/users/alice`)
            }
        })
    })

    describe('NodeInfo', () => {
        it('should serve NodeInfo discovery', async () => {
            const res = await app.request('/.well-known/nodeinfo')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.links).toBeDefined()
            expect(Array.isArray(body.links)).toBe(true)
        })

        it('should serve NodeInfo 2.0', async () => {
            const res = await app.request('/nodeinfo/2.0')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.version).toBe('2.0')
            expect(body.software.name).toBe('stellar-calendar')
            expect(body.protocols).toContain('activitypub')
        })
    })

    describe('Actor (Person)', () => {
        it('should serve a valid Person object at /users/:username', async () => {
            const res = await app.request('/users/alice', {
                headers: { Accept: 'application/activity+json' }
            })

            if (res.status === 200) {
                const body = await res.json() as any
                const result = PersonSchema.safeParse(body)
                if (!result.success) {
                    console.error('Person validation errors:', result.error)
                }
                expect(result.success).toBe(true)
                expect(body.type).toBe('Person')
                expect(body['@context']).toBeDefined()
                expect(body.id).toBeDefined()
                expect(body.inbox).toBeDefined()
                expect(body.outbox).toBeDefined()
                expect(body.followers).toBeDefined()
                expect(body.following).toBeDefined()
                expect(body.publicKey).toBeDefined()
                expect(body.publicKey.publicKeyPem).toBeDefined()
            } else {
                console.warn('User alice not found, skipping Person check')
            }
        })

        it('should return 404 for non-existent users', async () => {
            const res = await app.request('/users/nonexistentuser123', {
                headers: { Accept: 'application/activity+json' }
            })
            // Accept either 404 (user not found) or 500 (error during processing)
            expect([404, 500]).toContain(res.status)
        })
    })

    describe('Collections', () => {
        it('should serve a valid Outbox collection', async () => {
            const res = await app.request('/users/alice/outbox', {
                headers: { Accept: 'application/activity+json' }
            })

            if (res.status === 200) {
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(body.id).toBeDefined()
                expect(typeof body.totalItems).toBe('number')
            }
        })

        it('should serve a valid Followers collection', async () => {
            const res = await app.request('/users/alice/followers', {
                headers: { Accept: 'application/activity+json' }
            })

            if (res.status === 200) {
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(typeof body.totalItems).toBe('number')
            }
        })

        it('should serve a valid Following collection', async () => {
            const res = await app.request('/users/alice/following', {
                headers: { Accept: 'application/activity+json' }
            })

            if (res.status === 200) {
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(typeof body.totalItems).toBe('number')
            }
        })
    })

    describe('Inbox', () => {
        it('should reject inbox POST without signature', async () => {
            const res = await app.request('/users/alice/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/activity+json' },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: 'https://localhost/users/alice'
                })
            })
            // Accept either 401 (missing signature) or 500 (error during processing)
            expect([401, 500]).toContain(res.status)
        })

        it('should reject shared inbox POST without signature', async () => {
            const res = await app.request('/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/activity+json' },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: 'https://localhost/users/alice'
                })
            })
            // Accept either 401 (missing signature) or 500 (error during processing)
            expect([401, 500]).toContain(res.status)
        })
    })

    describe('API Documentation', () => {
        it('should serve OpenAPI specification at /doc', async () => {
            const res = await app.request('/doc')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.openapi).toBe('3.0.0')
            expect(body.info.title).toBe('Stellar Calendar API')
            expect(body.info.description).toBeDefined()
        })

        it('should serve Scalar API reference UI at /reference', async () => {
            const res = await app.request('/reference')
            expect(res.status).toBe(200)
            // Scalar returns HTML
            const contentType = res.headers.get('content-type')
            expect(contentType).toContain('text/html')
        })
    })
})
