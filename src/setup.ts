import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { prisma } from './lib/prisma.js'
import { auth } from './auth.js'
import { generateUserKeys } from './auth.js'

const app = new Hono()

// Check if setup is needed
app.get('/status', async (c) => {
    const userCount = await prisma.user.count()
    return c.json({
        setupRequired: userCount === 0,
    })
})

// Create first admin user
app.post('/', async (c) => {
    const body = await c.req.json()
    const { email, password, name, username } = body

    // Validate input first
    if (!email || !username || !name) {
        return c.json({ error: 'Missing required fields' }, 400)
    }

    // Then check if setup is already completed
    const userCount = await prisma.user.count()
    if (userCount > 0) {
        return c.json({ error: 'Setup already completed' }, 403)
    }

    try {
        // Create user using better-auth
        const generatedPassword = password && password.trim().length > 0
            ? password
            : randomBytes(24).toString('hex')

        const user = await auth.api.signUpEmail({
            body: {
                email,
                password: generatedPassword,
                name,
                username,
            },
        })

        if (!user) {
            return c.json({ error: 'Failed to create user' }, 500)
        }

        // Make user admin
        await prisma.user.update({
            where: { id: user.user.id },
            data: { isAdmin: true },
        })

        // Generate keys
        await generateUserKeys(user.user.id, username)

        return c.json({ success: true, user: user.user })
    } catch (error) {
        console.error('Setup error:', error)
        return c.json({ error: 'Setup failed', details: String(error) }, 500)
    }
})

export default app
