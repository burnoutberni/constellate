/**
 * Authentication Setup
 * better-auth configuration with user registration and key generation
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { generateKeyPair } from 'crypto'
import { promisify } from 'util'
import { encryptPrivateKey } from './lib/encryption.js'
import { config } from './config.js'
import { prisma } from './lib/prisma.js'

const generateKeyPairAsync = promisify(generateKeyPair)

/**
 * Generate RSA key pair and encrypt the private key.
 * This is the single source of truth for key generation parameters.
 * @returns Object with publicKey (PEM) and encryptedPrivateKey
 */
export async function generateAndEncryptRSAKeys(): Promise<{
	publicKey: string
	encryptedPrivateKey: string
}> {
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

	return { publicKey, encryptedPrivateKey }
}

// Helper function to generate keys for users
// If tx is provided, uses the transaction client; otherwise uses the regular prisma client
export async function generateUserKeys(
	userId: string,
	username: string,
	tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
	const { publicKey, encryptedPrivateKey } = await generateAndEncryptRSAKeys()

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
		provider: 'postgresql',
	}),
	secret: config.betterAuthSecret,
	baseURL: config.betterAuthUrl,
	trustedOrigins: config.betterAuthTrustedOrigins,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [],
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
		// Before hook: Validate ToS acceptance and username for signup requests
		// This uses better-auth's official hooks API instead of intercepting
		// request/response bodies, making it more maintainable and resilient
		// to changes in better-auth's internal structure.
		before: createAuthMiddleware(async (ctx) => {
			// Check if this is a signup attempt (Email/Password only)
			const isEmailSignup = ctx.path === '/sign-up/email'

			if (!isEmailSignup) {
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
		// This runs after a successful signup/login and has access to the user
		// via ctx.context.newSession.user.
		// If post-signup operations fail for a NEW user, the user is deleted.
		after: createAuthMiddleware(async (ctx) => {
			// We want to run this whenever a session is created to ensure the user is fully initialized
			// (Has keys, ToS accepted, etc.)
			// This covers /sign-up/email, etc.
			const newSession = ctx.context.newSession
			if (!newSession?.user) {
				return
			}

			const userId = newSession.user.id

			// Process post-signup operations atomically in a transaction
			await processSignupSuccess(userId)
		}),
	},
})

/**
 * Process post-signup operations:
 * 1. Update user with ToS acceptance timestamp and version (if missing)
 * 2. Generate cryptographic keys for ActivityPub (if missing)
 *
 * All operations are performed atomically in a single transaction.
 *
 * Exported for testing purposes.
 * @throws If any operation fails
 */
export async function processSignupSuccess(userId: string): Promise<void> {
	try {
		// Perform all post-signup operations in a single transaction
		// This ensures atomicity: either all operations succeed or none do
		await prisma.$transaction(async (tx) => {
			// First, fetch the user to check if keys/ToS are needed
			const user = await tx.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					isRemote: true,
					publicKey: true,
					privateKey: true,
					tosAcceptedAt: true,
				},
			})

			if (!user) {
				throw new Error(`User with id ${userId} not found`)
			}

			// Check what needs to be done
			const needsTos = !user.tosAcceptedAt
			// Generate keys for local users if missing
			const needsKeys = !user.isRemote && (!user.publicKey || !user.privateKey)

			// If user is already fully initialized, do nothing
			if (!needsTos && !needsKeys) {
				return
			}

			// Prepare update data
			const updateData: {
				tosAcceptedAt?: Date
				tosVersion?: number
				publicKey?: string
				privateKey?: string
			} = {}

			if (needsTos) {
				updateData.tosAcceptedAt = new Date()
				updateData.tosVersion = config.tosVersion
			}

			if (needsKeys) {
				if (!user.username) {
					throw new Error(
						'Username is required but was not found. This should not happen as username is validated during signup.'
					)
				}

				// Generate keys
				const { publicKey, encryptedPrivateKey } = await generateAndEncryptRSAKeys()

				updateData.publicKey = publicKey
				updateData.privateKey = encryptedPrivateKey
			}

			// Perform single atomic update with all data
			await tx.user.update({
				where: { id: userId },
				data: updateData,
			})

			if (needsKeys) {
				console.log(`✅ Generated and encrypted keys for user: ${user.username}`)
			}
		})
	} catch (error) {
		console.error(`❌ Post-signup/login processing failed for user ${userId}:`, error)

		// Attempt to cleanup potential zombie user if initialization failed.
		//
		// If the transaction failed, the user might be left in a "half-baked" state (e.g., created by better-auth
		// but missing ToS acceptance or keys).
		//
		// Strategy:
		// 1. Re-fetch the user to check their current state.
		// 2. If they still don't have `tosAcceptedAt` (meaning the update failed and they didn't have it before),
		//    we assume this was a failed signup attempt and delete the user to prevent an orphaned account.
		// 3. If they DO have `tosAcceptedAt`, we assume they were already valid or this was a migration/login issue,
		//    so we leave them alone to avoid deleting valid users.

		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				select: { tosAcceptedAt: true },
			})

			if (user && !user.tosAcceptedAt) {
				await prisma.user.delete({
					where: { id: userId },
				})
				console.log(`⚠️ Deleted uninitialized user ${userId}`)
			}
		} catch (cleanupError) {
			console.error(`❌ Failed to cleanup user ${userId}:`, cleanupError)
		}

		// Re-throw the original error so better-auth returns an error response
		throw error
	}
}

export type Session = typeof auth.$Infer.Session
