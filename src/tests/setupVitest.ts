// Patch require BEFORE importing prismock
// This redirects @prisma/client to our custom generated location
import './patchPrismaRequire.js'

import { beforeEach, vi } from 'vitest'
import { generatePrismock } from 'prismock'
import { PrismaClient } from '../generated/prisma/client.js'
import { join } from 'path'
import { existsSync, symlinkSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

// Create symlink from .prisma/client to our custom generated location
// This allows @prisma/client/default.js to find the generated client
const prismaClientPath = join(process.cwd(), 'node_modules', '.prisma', 'client')
const generatedPrismaPath = join(process.cwd(), 'src', 'generated', 'prisma')

if (!existsSync(prismaClientPath)) {
	try {
		// Ensure the .prisma directory exists
		mkdirSync(join(process.cwd(), 'node_modules', '.prisma'), { recursive: true })
		// Create symlink
		symlinkSync(generatedPrismaPath, prismaClientPath, 'dir')
	} catch (error) {
		// If symlink fails (e.g., already exists or permission issue), continue
		// The require patch should handle the resolution
		console.warn('Could not create symlink for .prisma/client:', error)
	}
}

// Get the Prisma schema path
const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')

// Prismock (which uses Prisma 5.22.0 internally) requires a 'url' field in the datasource,
// but Prisma 7 doesn't allow it. Create a temporary schema file with a dummy URL for prismock.
const tempSchemaPath = join(process.cwd(), 'prisma', 'schema.prismock.temp.prisma')
let tempSchemaCreated = false
let prismaMock: PrismaClient

try {
	// Read the original schema
	let schemaContent = readFileSync(schemaPath, 'utf-8')

	// Check if url is already present (shouldn't be for Prisma 7)
	if (!schemaContent.match(/datasource\s+\w+\s*\{[^}]*url/)) {
		// Add a dummy url field to the datasource block for prismock validation
		// Prismock only needs this for validation, it doesn't actually use the URL
		// Match: datasource db { ... provider = "postgresql" ... }
		schemaContent = schemaContent.replace(
			/(datasource\s+\w+\s*\{[^\}]*?provider\s*=\s*["'][^"']+["'])/s,
			(match) => {
				// Add url field after provider line
				return `${match}\n  url      = env("DATABASE_URL") // Dummy URL for prismock validation (Prisma 7 doesn't require this)`
			}
		)

		// Write temporary schema file
		writeFileSync(tempSchemaPath, schemaContent, 'utf-8')
		tempSchemaCreated = true
	}

	// Use the temporary schema if created, otherwise use the original
	const schemaToUse = tempSchemaCreated ? tempSchemaPath : schemaPath

	// Create the prismock instance
	// Note: generatePrismock is deprecated but works with custom paths
	// The deprecation warning can be ignored for now
	prismaMock = (await generatePrismock({
		schemaPath: schemaToUse,
	})) as unknown as PrismaClient

	// Verify prismock was created successfully
	if (!prismaMock || typeof prismaMock !== 'object') {
		throw new Error('Failed to create prismock instance')
	}
} catch (error) {
	console.error('Failed to create prismock instance:', error)
	throw error
} finally {
	// Clean up temporary schema file if we created it
	if (tempSchemaCreated && existsSync(tempSchemaPath)) {
		try {
			writeFileSync(tempSchemaPath, '', 'utf-8') // Clear it first
			// Note: We don't delete it to avoid race conditions, just clear it
			// It will be overwritten next time
		} catch {
			// Ignore cleanup errors
		}
	}
}

// Fix Prismock's handling of @default(now()) and @updatedAt fields
// Prismock doesn't automatically set these, so we need to wrap create/update operations
// This applies to models with timestamp fields: Event, EventTemplate, User, Notification, etc.
const wrapPrismockWithTimestamps = (mock: any): any => {
	const originalEventCreate = mock.event?.create?.bind(mock.event)
	const originalEventUpdate = mock.event?.update?.bind(mock.event)
	const originalEventFindUnique = mock.event?.findUnique?.bind(mock.event)

	// Also wrap EventTemplate methods
	const originalEventTemplateCreate = mock.eventTemplate?.create?.bind(mock.eventTemplate)
	const originalEventTemplateUpdate = mock.eventTemplate?.update?.bind(mock.eventTemplate)
	const originalEventTemplateFindUnique = mock.eventTemplate?.findUnique?.bind(mock.eventTemplate)

	// Early return if event methods are not available
	if (!originalEventCreate || !originalEventUpdate || !originalEventFindUnique) {
		console.warn('Warning: Some Event methods are not available, skipping timestamp wrapping')
		return mock
	}

	// Helper to ensure timestamps on an event object
	const ensureTimestamps = (event: any, preserveCreatedAt = false): any => {
		if (!event) return event
		const now = new Date()
		// Create a new object to avoid mutating Prismock's internal state
		return {
			...event,
			createdAt: event.createdAt || (preserveCreatedAt ? now : now),
			updatedAt: event.updatedAt || now,
			startTime: event.startTime || now,
		}
	}

	// Helper to ensure timestamps on models with createdAt/updatedAt (EventTemplate, User, etc.)
	const ensureModelTimestamps = (model: any, preserveCreatedAt = false): any => {
		if (!model) return model
		const now = new Date()
		return {
			...model,
			createdAt: model.createdAt || (preserveCreatedAt ? now : now),
			updatedAt: model.updatedAt || now,
		}
	}

	// Only wrap if event methods exist
	if (originalEventCreate && originalEventUpdate && originalEventFindUnique && mock.event) {
		// Wrap create to ensure createdAt and updatedAt are set
		mock.event.create = async (args: any) => {
			const now = new Date()
			if (args.data && !args.data.createdAt) {
				args.data.createdAt = now
			}
			if (args.data && !args.data.updatedAt) {
				args.data.updatedAt = now
			}
			const result = await originalEventCreate(args)
			return ensureTimestamps(result)
		}

		// Wrap update to ensure updatedAt is set
		mock.event.update = async (args: any) => {
			const now = new Date()
			// Get existing event to preserve createdAt
			const existing = await originalEventFindUnique({ where: args.where })
			const existingCreatedAt = existing?.createdAt

			if (args.data && !args.data.updatedAt) {
				args.data.updatedAt = now
			}
			const result = await originalEventUpdate(args)
			// Ensure timestamps, preserving original createdAt
			if (result) {
				return {
					...result,
					createdAt: result.createdAt || existingCreatedAt || new Date(),
					updatedAt: result.updatedAt || now,
					startTime: result.startTime || existing?.startTime || new Date(),
				}
			}
			return result
		}

		// Wrap findUnique to ensure timestamps are always present
		mock.event.findUnique = async (args: any) => {
			const result = await originalEventFindUnique(args)
			return ensureTimestamps(result, true) // Preserve createdAt if it exists
		}

		// Also wrap findFirst and findMany to ensure timestamps
		const originalEventFindFirst = mock.event.findFirst?.bind(mock.event)
		const originalEventFindMany = mock.event.findMany?.bind(mock.event)

		if (originalEventFindFirst) {
			mock.event.findFirst = async (args: any) => {
				const result = await originalEventFindFirst(args)
				return ensureTimestamps(result, true)
			}
		}

		if (originalEventFindMany) {
			mock.event.findMany = async (args: any) => {
				const results = await originalEventFindMany(args)
				return Array.isArray(results)
					? results.map((r: any) => ensureTimestamps(r, true))
					: results
			}
		}
	}

	// Wrap EventTemplate methods to ensure createdAt/updatedAt are set
	if (originalEventTemplateCreate) {
		mock.eventTemplate.create = async (args: any) => {
			const now = new Date()
			if (args.data && !args.data.createdAt) {
				args.data.createdAt = now
			}
			if (args.data && !args.data.updatedAt) {
				args.data.updatedAt = now
			}
			const result = await originalEventTemplateCreate(args)
			return ensureModelTimestamps(result)
		}
	}

	if (originalEventTemplateUpdate) {
		mock.eventTemplate.update = async (args: any) => {
			const now = new Date()
			// Get existing template to preserve createdAt
			const existing = await originalEventTemplateFindUnique({ where: args.where })
			const existingCreatedAt = existing?.createdAt

			if (args.data && !args.data.updatedAt) {
				args.data.updatedAt = now
			}
			const result = await originalEventTemplateUpdate(args)
			if (result) {
				return {
					...result,
					createdAt: result.createdAt || existingCreatedAt || new Date(),
					updatedAt: result.updatedAt || now,
				}
			}
			return result
		}
	}

	if (originalEventTemplateFindUnique) {
		mock.eventTemplate.findUnique = async (args: any) => {
			const result = await originalEventTemplateFindUnique(args)
			return ensureModelTimestamps(result, true)
		}
	}

	return mock
}

// Apply the timestamp fixes BEFORE making spyable
// This ensures the spies wrap the timestamp-fixed methods
if (!prismaMock) {
	throw new Error('prismaMock is not initialized. Check if prismock creation succeeded.')
}
wrapPrismockWithTimestamps(prismaMock)

// Make all prisma methods spyable so vi.mocked() and vi.spyOn() work
// This allows tests to mock individual methods while using the real prismock instance
// IMPORTANT: We need to preserve Prismock's internal structure, especially for $transaction
// The key insight: Prismock's $transaction passes the client itself as tx, and that client
// needs direct access to Prismock's delegates. We can't wrap tx with spies or it breaks.
const makeSpyable = (obj: any, originalObj?: any): any => {
	if (obj === null || obj === undefined || typeof obj !== 'object') {
		return obj
	}

	// Keep reference to original for $transaction
	const original = originalObj || obj

	// Create result object preserving prototype
	const result: any = Object.create(Object.getPrototypeOf(obj))

	// First, copy all properties using Object.assign to ensure we get everything
	Object.assign(result, obj)

	// Then process properties to make functions spyable
	for (const key in obj) {
		if (typeof obj[key] === 'function') {
			// Special handling for $transaction to ensure it works with Prismock
			if (key === '$transaction') {
				// CRITICAL: Spy on the original $transaction without replacing it
				// Prismock's $transaction has a closure that references the original client
				// vi.spyOn wraps the original function and calls it by default, preserving the closure
				// Tests can override with mockImplementation if needed, but by default it works
				// Don't use mockImplementation here as it might break the closure
				result[key] = vi.spyOn(original, key as any)
			} else {
				// Create a spy for other functions
				result[key] = vi.spyOn(obj, key as any)
			}
		} else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
			// Recursively make nested objects spyable
			// Pass original so nested $transaction calls work
			// This preserves model delegates (like event, user, etc.)
			result[key] = makeSpyable(obj[key], original)
		}
		// Arrays and primitives are already copied by Object.assign
	}

	return result
}

// Create a spyable version of prismaMock
let spyablePrisma = makeSpyable(prismaMock, prismaMock)

// Function to get the current spyable prisma instance
// This ensures we always get the latest version after reset/restore
function getSpyablePrisma() {
	return spyablePrisma
}

// Mock the prisma module with a factory that returns the current spyable version
// This allows us to update spyablePrisma in beforeEach and have it reflected in the mock
vi.mock('../lib/prisma.js', () => ({
	get prisma() {
		return getSpyablePrisma()
	},
}))

process.env.TZ = 'UTC'
process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
process.env.DATABASE_URL ??= 'file:./tests/dev.db'

beforeEach(async () => {
	// Verify prismaMock is initialized
	if (!prismaMock) {
		throw new Error('prismaMock is not initialized. Check if prismock creation succeeded.')
	}

	// Clear Prismock's data state between tests to ensure test isolation
	// Try reset() first (newer Prismock API), fall back to deleteMany() if not available
	if (typeof prismaMock.reset === 'function') {
		await prismaMock.reset()
	} else {
		// Manually delete all records in reverse dependency order
		// This is more reliable than setData({}) which doesn't always work correctly
		// Use optional chaining to handle cases where models might not exist
		await prismaMock.eventTag?.deleteMany({})
		await prismaMock.eventReminder?.deleteMany({})
		await prismaMock.commentMention?.deleteMany({})
		await prismaMock.comment?.deleteMany({})
		await prismaMock.eventLike?.deleteMany({})
		await prismaMock.eventAttendance?.deleteMany({})
		await prismaMock.notification?.deleteMany({})
		await prismaMock.inboxItem?.deleteMany({})
		await prismaMock.processedActivity?.deleteMany({})
		await prismaMock.failedDelivery?.deleteMany({})
		await prismaMock.eventTemplate?.deleteMany({})
		await prismaMock.follower?.deleteMany({})
		await prismaMock.following?.deleteMany({})
		await prismaMock.report?.deleteMany({})
		await prismaMock.blockedDomain?.deleteMany({})
		await prismaMock.blockedUser?.deleteMany({})
		await prismaMock.apiKey?.deleteMany({})
		await prismaMock.verification?.deleteMany({})
		await prismaMock.account?.deleteMany({})
		await prismaMock.session?.deleteMany({})
		await prismaMock.instance?.deleteMany({})
		await prismaMock.event?.deleteMany({})
		await prismaMock.user?.deleteMany({})
	}

	// Clear all mock call history (keeps spy implementations in place)
	vi.clearAllMocks()

	// Restore any existing spies before recreating to prevent nested spies
	if (spyablePrisma?.$transaction?.mockRestore) {
		spyablePrisma.$transaction.mockRestore()
	}

	// Recreate the spyable wrapper after clearing data and mocks
	// This ensures vi.mocked() continues to work and spies are properly connected
	spyablePrisma = makeSpyable(prismaMock, prismaMock)
})

export function getPrismaMock(): PrismaClient {
	return prismaMock as unknown as PrismaClient
}
