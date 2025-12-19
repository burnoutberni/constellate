/**
 * Authentication Setup
 * better-auth configuration with user registration and key generation
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { magicLink } from 'better-auth/plugins'
import { generateKeyPair } from 'crypto'
import { promisify } from 'util'
import { encryptPrivateKey } from './lib/encryption.js'
import { config } from './config.js'
import { prisma } from './lib/prisma.js'
import { sendEmail } from './lib/email.js'

const generateKeyPairAsync = promisify(generateKeyPair)

/**
 * Detect database provider from DATABASE_URL
 * Returns 'postgresql' for PostgreSQL URLs, 'sqlite' for SQLite URLs
 */
function detectDatabaseProvider(): 'postgresql' {
	return 'postgresql'
}

// Helper function to generate keys for users
// If tx is provided, uses the transaction client; otherwise uses the regular prisma client
export async function generateUserKeys(
	userId: string,
	username: string,
	tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
	const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
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

	const client = tx || prisma
	await client.user.update({
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
				required: true,
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
			// Only validate ToS and username for email/password signup
			if (ctx.path !== '/sign-up/email') {
				return
			}

			const body = ctx.body as { tosAccepted?: boolean; username?: string }

			// Validate username is provided and non-empty
			// Username is required for all users as it's their public identifier
			// and used to build URLs, make profiles findable, etc.
			if (
				!body.username ||
				typeof body.username !== 'string' ||
				body.username.trim().length === 0
			) {
				throw new APIError('BAD_REQUEST', {
					message:
						'Username is required. It is your public identifier and used to build your profile URL.',
				})
			}

			// Access tosAccepted from the request body
			// better-auth automatically parses the body for us
			const tosAccepted = body.tosAccepted

			if (tosAccepted !== true) {
				throw new APIError('BAD_REQUEST', {
					message: 'You must agree to the Terms of Service to create an account.',
				})
			}
		}),
		// After hook: Handle post-signup actions (ToS timestamp, key generation)
		// This runs after a successful signup and has access to the newly created
		// user via ctx.context.newSession.user, avoiding the need to parse response bodies.
		// If post-signup operations fail, the user is deleted to rollback the entire signup.
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

			// Process post-signup operations atomically in a transaction
			// If any operation fails, the user is deleted and the error is propagated
			// This ensures no partial user state exists in the database
			await processSignupSuccess(userId)
		}),
	},
})

/**
 * Process post-signup operations:
 * 1. Update user with ToS acceptance timestamp and version
 * 2. Generate cryptographic keys for ActivityPub (required for local users)
 *
 * All operations are performed atomically in a single transaction. If any operation fails,
 * the transaction is rolled back and the user is deleted to ensure no partial user state.
 *
 * Exported for testing purposes.
 * @throws If any operation fails, the user is deleted and the error is propagated
 */
export async function processSignupSuccess(userId: string): Promise<void> {
	try {
		// Perform all post-signup operations in a single transaction
		// This ensures atomicity: either all operations succeed or none do
		await prisma.$transaction(async (tx) => {
			// First, fetch the user to check if keys are needed
			const user = await tx.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					isRemote: true,
					publicKey: true,
					privateKey: true,
				},
			})

			if (!user) {
				throw new Error(`User with id ${userId} not found`)
			}

			// Prepare update data with ToS acceptance
			const updateData: {
				tosAcceptedAt: Date
				tosVersion: number
				publicKey?: string
				privateKey?: string
			} = {
				tosAcceptedAt: new Date(),
				tosVersion: config.tosVersion,
			}

			// Generate keys for local users (required for ActivityPub federation)
			// If key generation fails, the entire transaction will roll back
			// Username is required for all users - it's their public identifier
			if (!user.isRemote && (!user.publicKey || !user.privateKey)) {
				if (!user.username) {
					throw new Error(
						'Username is required but was not found. This should not happen as username is validated during signup.'
					)
				}

				// Generate keys
				const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
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

				updateData.publicKey = publicKey
				updateData.privateKey = encryptedPrivateKey
			}

			// Perform single atomic update with all data
			await tx.user.update({
				where: { id: userId },
				data: updateData,
			})

			if (updateData.publicKey) {
				console.log(`✅ Generated and encrypted keys for user: ${user.username}`)
			}
		})
	} catch (error) {
		// If the transaction fails, delete the user to roll back the entire signup
		// This ensures no partial user state exists in the database
		try {
			await prisma.user.delete({
				where: { id: userId },
			})
			console.error(`❌ Signup failed for user ${userId}, user deleted:`, error)
		} catch (deleteError) {
			// Log but don't throw - the original error is more important
			console.error(`❌ Failed to delete user ${userId} after signup failure:`, deleteError)
		}

		// Re-throw the original error so better-auth returns an error response
		throw error
	}
}

export type Session = typeof auth.$Infer.Session
