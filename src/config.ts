/**
 * Configuration Management
 * Validates and exports environment variables with proper defaults
 */

import { readFileSync, existsSync } from 'fs'

function requireEnv(key: string): string {
	const value = process.env[key]
	if (!value) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error(`Required environment variable ${key} is missing`)
		}
		throw new Error(`Required environment variable ${key} is missing (even in development)`)
	}
	return value
}

function getEnv(key: string, defaultValue: string, requiredInProduction: boolean = false): string {
	const value = process.env[key]
	if (!value) {
		if (requiredInProduction && process.env.NODE_ENV === 'production') {
			throw new Error(`Required environment variable ${key} is missing in production`)
		}
		return defaultValue
	}
	return value
}

/**
 * Helper to retrieve a secret from a file (Docker secret) or environment variable.
 * Checks for <KEY>_FILE environment variable first, then <KEY>.
 */
function getSecret(
	key: string,
	defaultValue: string = '',
	requiresFileInProduction: boolean = false
): string {
	let value: string | undefined

	// 1. Try to read from file path specified by <KEY>_FILE
	const filePath = process.env[`${key}_FILE`]
	if (filePath) {
		if (!existsSync(filePath)) {
			throw new Error(`Secret file (specified by ${key}_FILE at ${filePath}) does not exist.`)
		}
		try {
			value = readFileSync(filePath, 'utf-8').trim()
		} catch (e) {
			throw new Error(
				`Failed to read secret file (specified by ${key}_FILE at ${filePath}): ${(e as Error).message}`
			)
		}
	}

	// 2. If we have a value, return it
	if (value) {
		return value
	}

	// 3. If production requires a secret file, throw an error if not found
	if (requiresFileInProduction && process.env.NODE_ENV === 'production') {
		throw new Error(`Required secret ${key} (or ${key}_FILE) is missing or empty in production`)
	}

	// 4. Else return value from environment variable or fallback to default
	value = process.env[key] || defaultValue
	return value
}

export const config = {
	// Server configuration
	port: parseInt(getEnv('PORT', '3000')),
	nodeEnv: process.env.NODE_ENV || 'development',

	// Base URL - required in production
	baseUrl: getEnv('BETTER_AUTH_URL', 'http://localhost:3000', true),

	// Database
	databaseUrl: requireEnv('DATABASE_URL'),

	// Encryption key for private keys (32 bytes = 64 hex chars)
	encryptionKey: ((): string => {
		const key = getSecret('ENCRYPTION_KEY', '', true)
		if (!key) {
			throw new Error(
				'Required secret ENCRYPTION_KEY (or ENCRYPTION_KEY_FILE) is missing. Generate with: openssl rand -hex 32'
			)
		}
		if (key.length !== 64) {
			throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
		}
		return key
	})(),

	// Better Auth configuration
	betterAuthUrl: getEnv('BETTER_AUTH_URL', 'http://localhost:3000/api/auth'),
	betterAuthSecret: ((): string => {
		const secret = getSecret('BETTER_AUTH_SECRET', '', true)
		if (!secret) {
			throw new Error(
				'Required secret BETTER_AUTH_SECRET (or BETTER_AUTH_SECRET_FILE) is missing. Generate with: openssl rand -base64 32'
			)
		}
		return secret
	})(),
	betterAuthTrustedOrigins: (
		process.env.BETTER_AUTH_TRUSTED_ORIGINS || 'http://localhost:5173'
	).split(','),

	// CORS origins - required in production
	corsOrigins: ((): string[] => {
		const origins = process.env.CORS_ORIGINS
		if (!origins) {
			if (process.env.NODE_ENV === 'production') {
				throw new Error('CORS_ORIGINS is required in production')
			}
			return ['http://localhost:5173', 'http://localhost:3000']
		}
		return origins.split(',').map((o) => o.trim())
	})(),

	// Security settings
	isDevelopment: process.env.NODE_ENV !== 'production',
	isProduction: process.env.NODE_ENV === 'production',

	// External service identifiers
	locationSearch: {
		get userAgent(): string {
			// Compute User-Agent on first access to ensure baseUrl is properly set
			const customUserAgent = process.env.LOCATION_SEARCH_USER_AGENT
			if (customUserAgent) {
				return customUserAgent
			}
			// Extract base URL without path if it includes one
			try {
				const url = new URL(config.baseUrl)
				const baseUrlWithoutPath = `${url.protocol}//${url.host}`
				return `ConstellateLocation/1.0 (+${baseUrlWithoutPath})`
			} catch {
				// If baseUrl is not a valid URL, fall back to using it as-is
				return `ConstellateLocation/1.0 (+${config.baseUrl})`
			}
		},
		nominatimEndpoint: getEnv(
			'NOMINATIM_ENDPOINT',
			'https://nominatim.openstreetmap.org/search'
		),
	},

	// SMTP Configuration
	smtp: {
		host: getEnv('SMTP_HOST', ''),
		port: parseInt(getEnv('SMTP_PORT', '587')),
		secure: getEnv('SMTP_SECURE', 'false') === 'true',
		user: getEnv('SMTP_USER', ''),
		pass: getSecret('SMTP_PASS', ''),
		from: getEnv('SMTP_FROM', 'noreply@example.com'),
	},

	// Reminder Dispatcher Configuration
	enableReminderDispatcher: getEnv('ENABLE_REMINDER_DISPATCHER', 'true') === 'true',

	// Terms of Service
	tosVersion: parseInt(getEnv('TOS_VERSION', '1')), // Current ToS version - increment when ToS is updated
}

// Validate encryption key format
if (config.encryptionKey.length !== 64) {
	throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
}

// Log configuration status on startup (but not during tests)
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
if (config.isDevelopment && !isTest) {
	console.log('📋 Configuration loaded:')
	console.log(`   Environment: ${config.nodeEnv}`)
	console.log(`   Base URL: ${config.baseUrl}`)
	console.log(`   Port: ${config.port}`)
	if (!process.env.ENCRYPTION_KEY) {
		const keyFilePath = process.env.ENCRYPTION_KEY_FILE || '/app/.encryption-key'
		if (existsSync(keyFilePath)) {
			console.log(`   ✅ Using persisted encryption key from ${keyFilePath}`)
		} else {
			console.log('   ⚠️  Using auto-generated encryption key (development only)')
		}
	}
}
