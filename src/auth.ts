/**
 * Authentication Setup
 * better-auth configuration with user registration and key generation
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { magicLink } from 'better-auth/plugins'
import { generateKeyPairSync } from 'crypto'
import { encryptPrivateKey } from './lib/encryption.js'
import { config } from './config.js'
import { prisma } from './lib/prisma.js'
import { sendEmail } from './lib/email.js'

/**
 * Detect database provider from DATABASE_URL
 * Returns 'postgresql' for PostgreSQL URLs, 'sqlite' for SQLite URLs
 */
function detectDatabaseProvider(): 'postgresql' {
	return 'postgresql'
}

// Helper function to generate keys for users
export async function generateUserKeys(userId: string, username: string) {
	const { publicKey, privateKey } = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: 'spki',
			format: 'pem',
		},
		privateKeyEncoding: {
			type: 'pkcs8',
			format: 'pem',
		},
	})

	// Encrypt private key before storing
	const encryptedPrivateKey = encryptPrivateKey(privateKey)

	await prisma.user.update({
		where: { id: userId },
		data: {
			publicKey,
			privateKey: encryptedPrivateKey,
		},
	})

	console.log(`✅ Generated and encrypted keys for user: ${username}`)
}

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: detectDatabaseProvider(),
	}),
	baseURL: config.betterAuthUrl,
	trustedOrigins: config.betterAuthTrustedOrigins,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		magicLink({
			sendMagicLink: async (
				{ email, token: _token, url }: { email: string; token: string; url: string },
				_ctx?: unknown
			) => {
				await sendEmail({
					to: email,
					subject: 'Login to Constellate',
					text: `Click here to login: ${url}`,
					html: `<a href="${url}">Click here to login</a>`,
				})
			},
		}),
	],
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update session every 24 hours
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // 5 minutes
		},
	},
	user: {
		additionalFields: {
			username: {
				type: 'string',
				unique: true,
				required: false,
			},
			displayColor: {
				type: 'string',
				required: false,
				defaultValue: '#3b82f6',
			},
			tosAcceptedAt: {
				type: 'date',
				required: false,
			},
		},
	},
	hooks: {
		// Before hook: Validate ToS acceptance for signup requests
		// This uses better-auth's official hooks API instead of intercepting
		// request/response bodies, making it more maintainable and resilient
		// to changes in better-auth's internal structure.
		before: createAuthMiddleware(async (ctx) => {
			// Only validate ToS for email/password signup
			if (ctx.path !== '/sign-up/email') {
				return
			}

			// Access tosAccepted from the request body
			// better-auth automatically parses the body for us
			const tosAccepted = (ctx.body as { tosAccepted?: boolean })?.tosAccepted

			if (tosAccepted !== true) {
				throw new APIError('BAD_REQUEST', {
					message: 'You must agree to the Terms of Service to create an account.',
				})
			}
		}),
		// After hook: Handle post-signup actions (ToS timestamp, key generation)
		// This runs after a successful signup and has access to the newly created
		// user via ctx.context.newSession.user, avoiding the need to parse response bodies.
		after: createAuthMiddleware(async (ctx) => {
			// Only process email/password signup
			if (ctx.path !== '/sign-up/email') {
				return
			}

			const newSession = ctx.context.newSession
			if (!newSession?.user) {
				return
			}

			const userId = newSession.user.id

			// Process post-signup operations synchronously
			// Key generation is required - if it fails, signup fails
			await processSignupSuccess(userId)
		}),
	},
})

/**
 * Process post-signup operations:
 * 1. Update user with ToS acceptance timestamp and version
 * 2. Generate cryptographic keys for ActivityPub (required for local users)
 * Exported for testing purposes.
 * @throws If key generation fails, the error will propagate and cause signup to fail
 */
export async function processSignupSuccess(userId: string): Promise<void> {
	// Update user with ToS acceptance timestamp and version
	// tosAccepted is already verified by the before hook
	await prisma.user.update({
		where: { id: userId },
		data: {
			tosAcceptedAt: new Date(),
			tosVersion: config.tosVersion,
		},
	})

	// Query database to get the full user with username
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			username: true,
			isRemote: true,
			publicKey: true,
			privateKey: true,
		},
	})

	// Generate keys for local users (required for ActivityPub federation)
	// If key generation fails, signup will fail
	if (user && !user.isRemote && (!user.publicKey || !user.privateKey)) {
		await generateUserKeys(user.id, user.username)
	}
}

export type Session = typeof auth.$Infer.Session
