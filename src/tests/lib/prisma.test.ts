import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalEnv = { ...process.env }

// Create a proper class constructor mock
class PrismaClientMock {
	constructor(options?: any) {
		PrismaClientMock.constructorCall(options)
		return PrismaClientMock.instance
	}

	static constructorCall = vi.fn()
	static instance = {
		$disconnect: vi.fn(),
	}
}

const loadPrismaModule = async () => {
	return await vi.importActual<typeof import('../../lib/prisma.js')>('../../lib/prisma.js')
}

const resetGlobalPrisma = () => {
	delete (globalThis as Record<string, unknown>).prisma
}

describe('Prisma singleton', () => {
	beforeEach(async () => {
		await vi.resetModules()
		vi.clearAllMocks()
		PrismaClientMock.constructorCall.mockReset()
		PrismaClientMock.instance.$disconnect.mockReset()
		vi.doMock('@prisma/client', () => ({
			PrismaClient: PrismaClientMock,
			Prisma: {},
		}))
		process.env = { ...originalEnv }
		resetGlobalPrisma()
	})

	afterEach(() => {
		process.env = { ...originalEnv }
		resetGlobalPrisma()
	})

	it('enables verbose logging when PRISMA_LOG_QUERIES is true', async () => {
		process.env.PRISMA_LOG_QUERIES = 'true'

		await loadPrismaModule()

		expect(PrismaClientMock.constructorCall).toHaveBeenCalledTimes(1)
		expect(PrismaClientMock.constructorCall).toHaveBeenCalledWith({
			log: ['query', 'error', 'warn'],
		})
	})

	it('uses warn-level logging in development by default', async () => {
		process.env.PRISMA_LOG_QUERIES = undefined
		process.env.NODE_ENV = 'development'

		await loadPrismaModule()

		expect(PrismaClientMock.constructorCall).toHaveBeenCalledWith({
			log: ['error', 'warn'],
		})
	})

	it('limits logging and disconnects gracefully in production', async () => {
		let beforeExitHandler: (() => Promise<void> | void) | undefined

		const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
			if (event === 'beforeExit') {
				beforeExitHandler = handler as () => Promise<void> | void
			}
			return process
		})

		process.env.PRISMA_LOG_QUERIES = undefined
		process.env.NODE_ENV = 'production'

		await loadPrismaModule()

		expect(PrismaClientMock.constructorCall).toHaveBeenCalledWith({
			log: ['error'],
		})
		expect(onSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function))

		await beforeExitHandler?.()
		expect(PrismaClientMock.instance.$disconnect).toHaveBeenCalledTimes(1)

		onSpy.mockRestore()
	})
})
