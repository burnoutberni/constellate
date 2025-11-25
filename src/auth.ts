/**
 * Authentication Setup
 * better-auth configuration with user registration and key generation
 */

import { betterAuth } from 'better-auth'
import { PrismaClient } from '@prisma/client'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { generateKeyPairSync } from 'crypto'

const prisma = new PrismaClient()

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

    await prisma.user.update({
        where: { id: userId },
        data: {
            publicKey,
            privateKey,
        },
    })

    console.log(`✅ Generated keys for user: ${username}`)
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'sqlite',
    }),
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000/api/auth',
    trustedOrigins: ['http://localhost:5173'],
    emailAndPassword: {
        enabled: true,
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
