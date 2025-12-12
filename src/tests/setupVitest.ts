import { beforeEach, vi } from 'vitest'
import createPrismaMock from 'prisma-mock/client'
import { Prisma, PrismaClient } from '../generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { mockDeep } from 'vitest-mock-extended'

// Get the datamodel using Prisma's getDMMF function
// We need to read the schema and generate the DMMF
import { readFileSync } from 'fs'
import { join } from 'path'

let datamodel: any

try {
	// Try to use Prisma CLI to get DMMF
	// This is a workaround for Prisma 7 with custom output paths
	const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
	const schema = readFileSync(schemaPath, 'utf-8')
	
	// Use dynamic import to get getDMMF from @prisma/internals
	// We'll try importing it, but if it fails, we'll use a fallback
	const prismaInternals = await import('@prisma/internals').catch(() => null)
	
	if (prismaInternals?.getDMMF) {
		const dmmf = await prismaInternals.getDMMF({ datamodel: schema })
		datamodel = dmmf.datamodel
	} else {
		// Fallback: try to access from PrismaClient
		// This might not work, but it's worth trying
		const mockAdapter = new PrismaPg({ connectionString: 'postgresql://user:pass@localhost:5432/test' })
		const tempClient = new PrismaClient({ adapter: mockAdapter })
		datamodel = (tempClient as any).$dmmf?.datamodel
		void tempClient.$disconnect().catch(() => {})
	}
} catch (error) {
	console.error('Error getting datamodel:', error)
	throw new Error(
		'Could not access Prisma datamodel. This might be a compatibility issue with Prisma 7 and prisma-mock.'
	)
}

if (!datamodel) {
	throw new Error(
		'Could not access Prisma datamodel. Make sure Prisma client is generated with `npm run db:generate`'
	)
}

// Create a vitest mock first using mockDeep
// This makes it compatible with vi.mocked()
const vitestMock = mockDeep<PrismaClient>()

// Create the prisma mock instance using prisma-mock
// Pass the vitest mock as mockClient so prisma-mock uses it as the base
// This gives us both the in-memory database functionality and vitest mocking compatibility
// Note: createPrismaMock modifies the mockClient in place, so prismaMock and vitestMock
// reference the same object with prisma-mock functionality added
const prismaMock = createPrismaMock<PrismaClient, typeof Prisma>(Prisma, {
	datamodel,
	mockClient: vitestMock as any, // Cast to any to satisfy type requirements
	enableIndexes: true, // Explicitly enable indexes for better query performance and unique constraint enforcement
})

// Mock the prisma module
vi.mock('../lib/prisma.js', () => ({
	prisma: prismaMock,
}))

process.env.TZ = 'UTC'
process.env.NODE_ENV = 'test'
process.env.VITEST = 'true'
process.env.DATABASE_URL ??= 'file:./tests/dev.db'

beforeEach(() => {
	// Reset the mock state by clearing all data FIRST
	// prisma-mock stores data in $getInternalState()
	const state = (prismaMock as any).$getInternalState()
	// Clear all data by resetting each model's data array
	if (state) {
		Object.keys(state).forEach((key) => {
			if (Array.isArray(state[key as keyof typeof state])) {
				;(state[key as keyof typeof state] as any[]).length = 0
			}
		})
	}
	
	// Manually restore prisma method spies to preserve prisma-mock functionality
	// We restore spies on prisma models that might have been spied on in tests
	// This is safer than vi.restoreAllMocks() which might restore to the wrong implementation
	const prismaModels = ['event', 'user', 'eventTag', 'eventAttendance', 'eventLike', 'comment', 'eventReminder', 'eventTemplate', 'following']
	for (const model of prismaModels) {
		const modelObj = (prismaMock as any)[model]
		if (modelObj) {
			// Restore all methods on this model that might have been spied on
			const methods = ['create', 'findMany', 'findUnique', 'update', 'delete', 'deleteMany', 'createMany', 'findFirst', 'findFirstOrThrow', 'findUniqueOrThrow', 'upsert', 'count', 'aggregate', 'groupBy']
			for (const method of methods) {
				if (modelObj[method] && typeof modelObj[method].mockRestore === 'function') {
					try {
						modelObj[method].mockRestore()
					} catch (e) {
						// Ignore errors if restore fails (e.g., not a spy)
					}
				}
			}
		}
	}
	
	// Re-apply prisma-mock to ensure nested creates and other functionality work
	// This is necessary because restoring spies might have broken the prisma-mock implementation
	try {
		createPrismaMock<PrismaClient, typeof Prisma>(Prisma, {
			datamodel,
			mockClient: vitestMock as any,
		})
	} catch (e) {
		// If re-applying fails, that's okay - the original implementation should still work
		// This can happen if the structure was already correct
	}
	
	// Clear all mocks to ensure clean call history
	vi.clearAllMocks()
})

export function getPrismaMock(): PrismaClient {
	return prismaMock
}
