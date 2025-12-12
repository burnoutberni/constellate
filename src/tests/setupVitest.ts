// Patch require BEFORE importing prismock
// This redirects @prisma/client to our custom generated location
import './patchPrismaRequire.js'

import { beforeEach, vi } from 'vitest'
import { generatePrismock } from 'prismock'
import { PrismaClient } from '../generated/prisma/client.js'
import { join } from 'path'
import { existsSync, symlinkSync, mkdirSync } from 'fs'

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

// Create the prismock instance
// Note: generatePrismock is deprecated but works with custom paths
// The deprecation warning can be ignored for now
const prismaMock = await generatePrismock({ 
	schemaPath,
})

// Fix Prismock's handling of @default(now()) and @updatedAt fields
// Prismock doesn't automatically set these, so we need to wrap create/update operations
// This applies to models with timestamp fields: Event, EventTemplate, User, Notification, etc.
const wrapPrismockWithTimestamps = (mock: any): any => {
	const originalEventCreate = mock.event.create.bind(mock.event)
	const originalEventUpdate = mock.event.update.bind(mock.event)
	const originalEventFindUnique = mock.event.findUnique.bind(mock.event)
	
	// Also wrap EventTemplate methods
	const originalEventTemplateCreate = mock.eventTemplate?.create?.bind(mock.eventTemplate)
	const originalEventTemplateUpdate = mock.eventTemplate?.update?.bind(mock.eventTemplate)
	const originalEventTemplateFindUnique = mock.eventTemplate?.findUnique?.bind(mock.eventTemplate)

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
			return Array.isArray(results) ? results.map((r: any) => ensureTimestamps(r, true)) : results
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
	
	const result: any = {}
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
		} else if (typeof obj[key] === 'object' && obj[key] !== null) {
			// Recursively make nested objects spyable
			// Pass original so nested $transaction calls work
			result[key] = makeSpyable(obj[key], original)
		} else {
			result[key] = obj[key]
		}
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
	// Clear Prismock's data state between tests to ensure test isolation
	// Try reset() first (newer Prismock API), fall back to deleteMany() if not available
	if (typeof prismaMock.reset === 'function') {
		await prismaMock.reset()
	} else {
		// Manually delete all records in reverse dependency order
		// This is more reliable than setData({}) which doesn't always work correctly
		await prismaMock.eventTag.deleteMany({})
		await prismaMock.eventReminder.deleteMany({})
		await prismaMock.commentMention.deleteMany({})
		await prismaMock.comment.deleteMany({})
		await prismaMock.eventLike.deleteMany({})
		await prismaMock.eventAttendance.deleteMany({})
		await prismaMock.notification.deleteMany({})
		await prismaMock.inboxItem.deleteMany({})
		await prismaMock.processedActivity.deleteMany({})
		await prismaMock.failedDelivery.deleteMany({})
		await prismaMock.eventTemplate.deleteMany({})
		await prismaMock.follower.deleteMany({})
		await prismaMock.following.deleteMany({})
		await prismaMock.report.deleteMany({})
		await prismaMock.blockedDomain.deleteMany({})
		await prismaMock.blockedUser.deleteMany({})
		await prismaMock.apiKey.deleteMany({})
		await prismaMock.verification.deleteMany({})
		await prismaMock.account.deleteMany({})
		await prismaMock.session.deleteMany({})
		await prismaMock.instance.deleteMany({})
		await prismaMock.event.deleteMany({})
		await prismaMock.user.deleteMany({})
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
