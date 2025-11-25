/**
 * Configuration Management
 * Validates and exports environment variables with proper defaults
 */

import { randomBytes } from 'crypto'

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
        if (!key) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('ENCRYPTION_KEY is required in production. Generate with: openssl rand -hex 32')
            }
            // Generate a random key for development (warn user)
            const devKey = randomBytes(32).toString('hex')
            console.warn('⚠️  WARNING: Using auto-generated ENCRYPTION_KEY for development. This is not secure for production!')
            console.warn(`   Generated key: ${devKey}`)
            console.warn('   Set ENCRYPTION_KEY environment variable for production.')
            return devKey
        }
        if (key.length !== 64) {
            throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
        }
        return key
    })(),
    
    // Better Auth configuration
    betterAuthUrl: getEnv('BETTER_AUTH_URL', 'http://localhost:3000/api/auth'),
    betterAuthTrustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS || 'http://localhost:5173').split(','),
    
    // CORS origins
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    
    // Security settings
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
}

// Validate encryption key format
if (config.encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
}

// Log configuration status on startup
if (config.isDevelopment) {
    console.log('📋 Configuration loaded:')
    console.log(`   Environment: ${config.nodeEnv}`)
    console.log(`   Base URL: ${config.baseUrl}`)
    console.log(`   Port: ${config.port}`)
    if (!process.env.ENCRYPTION_KEY) {
        console.log('   ⚠️  Using auto-generated encryption key (development only)')
    }
}

