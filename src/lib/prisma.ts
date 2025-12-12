/**
 * Prisma Client Singleton
 * Prevents connection pool exhaustion by using a single instance
 */

import { PrismaClient, Prisma } from '@prisma/client'

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

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
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
