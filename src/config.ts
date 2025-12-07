/**
 * Configuration Management
 * Validates and exports environment variables with proper defaults
 */

import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'

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
        const key = process.env.ENCRYPTION_KEY
        const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

        // If key is provided via env var, use it
        if (key) {
            if (key.length !== 64) {
                throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
            }
            return key
        }

        // In production, require the key
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_KEY is required in production. Generate with: openssl rand -hex 32')
        }

        // In development, try to read from or create a persistent key file
        // This ensures the same key is used across container restarts
        const keyFilePath = process.env.ENCRYPTION_KEY_FILE || '/app/.encryption-key'

        try {
            if (existsSync(keyFilePath)) {
                const fileKey = readFileSync(keyFilePath, 'utf8').trim()
                if (fileKey.length === 64) {
                    if (!isTest) {
                        console.log(`✅ Loaded encryption key from ${keyFilePath}`)
                    }
                    return fileKey
                } else {
                    console.warn(`⚠️  Encryption key file exists but has invalid length, generating new key`)
                }
            }

            // Generate a new key and save it
            const devKey = randomBytes(32).toString('hex')
            writeFileSync(keyFilePath, devKey, { mode: 0o600 }) // Read/write for owner only

            if (!isTest) {
                console.log(`✅ Generated and saved encryption key to ${keyFilePath}`)
                console.log('   This key will persist across container restarts in development.')
            }
            return devKey
        } catch {
            // If file operations fail (e.g., in tests or read-only filesystem), fall back to in-memory key
            const devKey = randomBytes(32).toString('hex')
            if (!isTest) {
                console.warn('⚠️  WARNING: Could not persist encryption key to file. Using in-memory key.')
                console.warn('   This key will be lost on restart. Set ENCRYPTION_KEY environment variable.')
            }
            return devKey
        }
    })(),

    // Better Auth configuration
    betterAuthUrl: getEnv('BETTER_AUTH_URL', 'http://localhost:3000/api/auth'),
    betterAuthSecret: getEnv('BETTER_AUTH_SECRET', '', true), // Required in production
    betterAuthTrustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS || 'http://localhost:5173').split(','),

    // CORS origins - required in production
    corsOrigins: ((): string[] => {
        const origins = process.env.CORS_ORIGINS
        if (!origins) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('CORS_ORIGINS is required in production')
            }
            return ['http://localhost:5173', 'http://localhost:3000']
        }
        return origins.split(',').map(o => o.trim())
    })(),

    // Security settings
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // SMTP Configuration
    smtp: {
        host: getEnv('SMTP_HOST', ''),
        port: parseInt(getEnv('SMTP_PORT', '587')),
        secure: getEnv('SMTP_SECURE', 'false') === 'true',
        user: getEnv('SMTP_USER', ''),
        pass: getEnv('SMTP_PASS', ''),
        from: getEnv('SMTP_FROM', 'noreply@example.com'),
    },

    // Location Search Configuration
    locationSearch: {
        userAgent: getEnv('LOCATION_SEARCH_USER_AGENT', 'Constellate/1.0'),
    },
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

