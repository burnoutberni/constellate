/**
 * Authentication Setup
 * better-auth configuration with user registration and key generation
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { generateKeyPairSync } from 'crypto'
import { encryptPrivateKey } from './lib/encryption.js'
import { config } from './config.js'
import { prisma } from './lib/prisma.js'

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
        provider: 'sqlite',
    }),
    baseURL: config.betterAuthUrl,
    trustedOrigins: config.betterAuthTrustedOrigins,
    emailAndPassword: {
        enabled: true,
    },
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
        },
    },
})

export type Session = typeof auth.$Infer.Session
