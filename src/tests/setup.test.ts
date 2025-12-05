/**
 * Tests for Setup Routes
 * Tests for onboarding and initial admin user creation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

describe('Setup Routes', () => {
    beforeEach(async () => {
        await prisma.user.deleteMany()

        vi.spyOn(authModule.auth.api, 'signUpEmail').mockImplementation(async ({ body }) => {
            const createdUser = await prisma.user.create({
                data: {
                    username: body.username,
                    email: body.email,
                    name: body.name,
                    isRemote: false,
                },
            })

            return {
                user: createdUser,
            } as any
        })

        vi.spyOn(authModule, 'generateUserKeys').mockResolvedValue(undefined)
    })

    afterEach(async () => {
        vi.restoreAllMocks()
    })

    describe('POST /api/setup', () => {



        it('should reject setup with missing email', async () => {
            const setupData = {
                username: 'admin',
                name: 'Admin User',
                password: 'securepassword123',
            }

            const res = await app.request('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(setupData),
            })

            expect(res.status).toBe(400)

            const data = await res.json() as { error: string }
            expect(data.error).toBe('Missing required fields')
        })

        it('should reject setup with missing username', async () => {
            const setupData = {
                email: 'admin@example.com',
                name: 'Admin User',
                password: 'securepassword123',
            }

            const res = await app.request('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(setupData),
            })

            expect(res.status).toBe(400)

            const data = await res.json() as { error: string }
            expect(data.error).toBe('Missing required fields')
        })

        it('should reject setup with missing name', async () => {
            const setupData = {
                email: 'admin@example.com',
                username: 'admin',
                password: 'securepassword123',
            }

            const res = await app.request('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(setupData),
            })

            expect(res.status).toBe(400)

            const data = await res.json() as { error: string }
            expect(data.error).toBe('Missing required fields')
        })

        it('should allow setup without password (for magic link only)', async () => {
            const setupData = {
                email: 'admin@example.com',
                username: 'admin',
                name: 'Admin User',
            }

            const res = await app.request('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(setupData),
            })

            expect(res.status).toBe(200)

            const signUpCall = vi.mocked(authModule.auth.api.signUpEmail).mock.calls[0]?.[0]
            expect(typeof signUpCall?.body?.password).toBe('string')
            expect(signUpCall?.body?.password?.length || 0).toBeGreaterThan(0)
        })
    })
})
