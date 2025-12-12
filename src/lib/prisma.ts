/**
 * Prisma Client Singleton
 * Prevents connection pool exhaustion by using a single instance
 */

import { PrismaClient } from '../generated/prisma/client.js'
import type { Prisma } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from '../config.js'

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

// Determine log level based on environment
// Set PRISMA_LOG_QUERIES=true to enable query logging
const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === 'true'
let logLevel: Prisma.LogLevel[]
if (shouldLogQueries) {
	logLevel = ['query', 'error', 'warn']
} else if (process.env.NODE_ENV === 'development') {
	logLevel = ['error', 'warn']
} else {
	logLevel = ['error']
}

// Create Prisma adapter with connection string
// Prisma will manage its own connection pool internally
const adapter = new PrismaPg({ connectionString: config.databaseUrl })

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
		log: logLevel,
	})

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma
}

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
	process.on('beforeExit', async () => {
		await prisma.$disconnect()
	})
}
