/**
 * Admin Routes
 * User management and API key management (admin only)
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { requireAdmin } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'
import { generateUserKeys } from './auth.js'
import { createHash, randomBytes } from 'crypto'
import { AppError } from './lib/errors.js'

const app = new Hono()

// User list schema
const UserListQuerySchema = z.object({
    page: z.string().optional().transform((val) => parseInt(val || '1')),
    limit: z.string().optional().transform((val) => Math.min(parseInt(val || '20'), 100)),
    search: z.string().optional(),
    isBot: z.string().optional().transform((val) => {
        // Only return boolean if explicitly 'true' or 'false'
        // If undefined/empty, return undefined (don't filter)
        if (val === 'true') return true
        if (val === 'false') return false
        return undefined
    }),
})

// Create user schema
const CreateUserSchema = z.object({
    username: z.string().min(1).max(50),
    email: z.string().email().optional(),
    name: z.string().optional(),
    isAdmin: z.boolean().optional().default(false),
    isBot: z.boolean().optional().default(false),
    displayColor: z.string().optional(),
    bio: z.string().optional(),
    password: z.string().min(8).optional(), // Required for non-bot users
})

// Update user schema
const UpdateUserSchema = z.object({
    username: z.string().min(1).max(50).optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    isAdmin: z.boolean().optional(),
    isBot: z.boolean().optional(),
    displayColor: z.string().optional(),
    bio: z.string().optional(),
})

// Create API key schema
const CreateApiKeySchema = z.object({
    userId: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
})

// List users (admin only)
app.get('/users', async (c) => {
    try {
        await requireAdmin(c)

        const query = UserListQuerySchema.parse({
            page: c.req.query('page'),
            limit: c.req.query('limit'),
            search: c.req.query('search'),
            isBot: c.req.query('isBot'),
        })

        const page = query.page
        const limit = query.limit
        const skip = (page - 1) * limit

        // Build where clause
        const where: { OR?: Array<{ username?: { contains: string }, name?: { contains: string }, email?: { contains: string } }>, isBot?: boolean } = {}
        if (query.search) {
            where.OR = [
                { username: { contains: query.search } },
                { name: { contains: query.search } },
                { email: { contains: query.search } },
            ]
        }
        // Only filter by isBot if explicitly provided (true or false)
        // If undefined, don't filter (show all users)
        if (query.isBot !== undefined && query.isBot !== null) {
            where.isBot = query.isBot
        }

        // Debug logging
        console.log('[Admin] Listing users with filter:', JSON.stringify(where))
        console.log('[Admin] Query params:', { page, limit, search: query.search, isBot: query.isBot })

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    name: true,
                    isAdmin: true,
                    isBot: true,
                    isRemote: true,
                    displayColor: true,
                    bio: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            events: true,
                            followers: true,
                            following: true,
                        },
                    },
                } as unknown as Record<string, unknown>,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.user.count({ where }),
        ])

        console.log('[Admin] Returning users:', users.length, 'total:', total)
        console.log('[Admin] User usernames:', users.map(u => u.username))

        return c.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error listing users:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get user by ID (admin only)
app.get('/users/:id', async (c) => {
    try {
        await requireAdmin(c)

        const { id } = c.req.param()

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                isAdmin: true,
                isBot: true,
                isRemote: true,
                displayColor: true,
                bio: true,
                profileImage: true,
                headerImage: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        events: true,
                        followers: true,
                        following: true,
                        apiKeys: true,
                    } as unknown as Record<string, unknown>,
                },
            } as unknown as Record<string, unknown>,
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        return c.json(user)
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        console.error('Error getting user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Create user (admin only)
app.post('/users', async (c) => {
    try {
        await requireAdmin(c)

        const body = await c.req.json()
        const data = CreateUserSchema.parse(body)

        // For non-bot users, password is required
        if (!data.isBot && !data.password) {
            return c.json({ error: 'Password is required for non-bot users' }, 400)
        }

        // Check if username already exists
        const existingUser = await prisma.user.findUnique({
            where: { username: data.username },
        })

        if (existingUser) {
            return c.json({ error: 'Username already exists' }, 400)
        }

        // Check if email already exists (if provided)
        if (data.email) {
            const existingEmail = await prisma.user.findUnique({
                where: { email: data.email },
            })

            if (existingEmail) {
                return c.json({ error: 'Email already exists' }, 400)
            }
        }

        // Create user account via better-auth if password is provided
        let userId: string
        if (data.password && !data.isBot) {
            // Use better-auth to create the account (this handles password hashing)
            const { auth } = await import('./auth.js')
            const result = await auth.api.signUpEmail({
                body: {
                    email: data.email || `${data.username}@example.com`,
                    password: data.password,
                    name: data.name || data.username,
                    username: data.username,
                },
            })

            if (!result || !result.user) {
                return c.json({ error: 'Failed to create user account' }, 500)
            }

            userId = result.user.id

            // Update user with additional fields
            await prisma.user.update({
                where: { id: userId },
                data: {
                    username: data.username,
                    isAdmin: data.isAdmin || false,
                    isBot: data.isBot || false,
                    displayColor: data.displayColor,
                    bio: data.bio,
                } as unknown as Record<string, unknown>,
            })
        } else {
            // Create bot user directly (no password/auth needed)
            const user = await prisma.user.create({
                data: ({
                    username: data.username,
                    email: data.email || null,
                    name: data.name || data.username,
                    isAdmin: data.isAdmin || false,
                    isBot: true,
                    displayColor: data.displayColor || '#3b82f6',
                    bio: data.bio,
                    isRemote: false,
                } as unknown) as Parameters<typeof prisma.user.create>[0]['data'],
            })

            userId = user.id

            // Generate keys for bot user
            await generateUserKeys(userId, data.username)
        }

        // Fetch created user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                isAdmin: true,
                isBot: true,
                displayColor: true,
                bio: true,
                createdAt: true,
            } as unknown as Record<string, unknown>,
        })

        return c.json(user, 201)
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error creating user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update user (admin only)
app.put('/users/:id', async (c) => {
    try {
        await requireAdmin(c)

        const { id } = c.req.param()
        const body = await c.req.json()
        const data = UpdateUserSchema.parse(body)

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Check username uniqueness if changing
        if (data.username && data.username !== existingUser.username) {
            const usernameExists = await prisma.user.findUnique({
                where: { username: data.username },
            })

            if (usernameExists) {
                return c.json({ error: 'Username already exists' }, 400)
            }
        }

        // Check email uniqueness if changing
        if (data.email && data.email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email: data.email },
            })

            if (emailExists) {
                return c.json({ error: 'Email already exists' }, 400)
            }
        }

        // Update user
        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(data.username && { username: data.username }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.name !== undefined && { name: data.name }),
                ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
                ...(data.isBot !== undefined && { isBot: data.isBot }),
                ...(data.displayColor !== undefined && { displayColor: data.displayColor }),
                ...(data.bio !== undefined && { bio: data.bio }),
            } as unknown as Record<string, unknown>,
            select: {
                id: true,
                username: true,
                email: true,
                name: true,
                isAdmin: true,
                isBot: true,
                displayColor: true,
                bio: true,
                updatedAt: true,
            } as unknown as Record<string, unknown>,
        })

        return c.json(user)
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error updating user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete user (admin only)
app.delete('/users/:id', async (c) => {
    try {
        await requireAdmin(c)

        const { id } = c.req.param()

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Prevent deleting yourself
        const currentUserId = c.get('userId')
        if (id === currentUserId) {
            return c.json({ error: 'Cannot delete your own account' }, 400)
        }

        // Delete user (cascade will handle related records)
        await prisma.user.delete({
            where: { id },
        })

        return c.json({ success: true })
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        console.error('Error deleting user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// List API keys (admin only)
app.get('/api-keys', async (c) => {
    try {
        await requireAdmin(c)

        const userId = c.req.query('userId')

        const where: { userId?: string } = {}
        if (userId) {
            where.userId = userId
        }

        const apiKeys = await (prisma as unknown as { apiKey: { findMany: (args: { where?: { userId?: string }; include?: { user: { select: { id: boolean; username: boolean; name: boolean } } }; orderBy: { createdAt: string } }) => Promise<Array<{ id: string; name: string; description: string | null; prefix: string; userId: string; user: { id: string; username: string; name: string | null }; createdAt: Date; updatedAt: Date; lastUsedAt: Date | null }>> } }).apiKey.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        // Don't return the full key hash, just the prefix
        const sanitizedKeys = apiKeys.map((key: typeof apiKeys[0]) => ({
            id: key.id,
            name: key.name,
            description: key.description,
            prefix: key.prefix,
            userId: key.userId,
            user: key.user,
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
            lastUsedAt: key.lastUsedAt,
        }))

        return c.json({ apiKeys: sanitizedKeys })
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        console.error('Error listing API keys:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Create API key (admin only)
app.post('/api-keys', async (c) => {
    try {
        await requireAdmin(c)

        const body = await c.req.json()
        const data = CreateApiKeySchema.parse(body)

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: data.userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Generate API key
        const rawKey = `sk_live_${randomBytes(32).toString('hex')}`
        const keyHash = createHash('sha256').update(rawKey).digest('hex')
        const prefix = rawKey.substring(0, 12) // "sk_live_xxxx"

        // Create API key record
        const apiKey = await (prisma as unknown as { apiKey: { create: (args: { data: { name: string; description?: string; keyHash: string; prefix: string; userId: string }; include?: { user: { select: { id: boolean; username: boolean; name: boolean } } } }) => Promise<{ id: string; name: string; description: string | null; prefix: string; userId: string; user: { id: string; username: string; name: string | null }; createdAt: Date }> } }).apiKey.create({
            data: {
                name: data.name,
                description: data.description,
                keyHash,
                prefix,
                userId: data.userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                    },
                },
            },
        })

        // Return the key only once (client should save it)
        return c.json({
            id: apiKey.id,
            name: apiKey.name,
            description: apiKey.description,
            key: rawKey, // Only returned on creation
            prefix: apiKey.prefix,
            userId: apiKey.userId,
            user: apiKey.user,
            createdAt: apiKey.createdAt,
            warning: 'Save this key now. You will not be able to see it again.',
        }, 201)
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error creating API key:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete API key (admin only)
app.delete('/api-keys/:id', async (c) => {
    try {
        await requireAdmin(c)

        const { id } = c.req.param()

        // Check if API key exists
        const apiKey = await (prisma as unknown as { apiKey: { findUnique: (args: { where: { id: string } }) => Promise<{ id: string } | null> } }).apiKey.findUnique({
            where: { id },
        })

        if (!apiKey) {
            return c.json({ error: 'API key not found' }, 404)
        }

        // Delete API key
        await (prisma as unknown as { apiKey: { delete: (args: { where: { id: string } }) => Promise<{ id: string }> } }).apiKey.delete({
            where: { id },
        })

        return c.json({ success: true })
    } catch (error) {
        if (error instanceof AppError) {
            throw error // Let the global error handler deal with it
        }
        console.error('Error deleting API key:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app

