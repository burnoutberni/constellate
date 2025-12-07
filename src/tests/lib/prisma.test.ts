import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalEnv = { ...process.env }
const PrismaClientMock = vi.fn()

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
        PrismaClientMock.mockReset()
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
        const disconnectSpy = vi.fn()
        let receivedOptions: any

        PrismaClientMock.mockImplementation((options) => {
            receivedOptions = options
            return { $disconnect: disconnectSpy }
        })

        process.env.PRISMA_LOG_QUERIES = 'true'

        await loadPrismaModule()

        expect(PrismaClientMock).toHaveBeenCalledTimes(1)
        expect(receivedOptions).toEqual({ log: ['query', 'error', 'warn'] })
    })

    it('uses warn-level logging in development by default', async () => {
        const disconnectSpy = vi.fn()
        let receivedOptions: any

        PrismaClientMock.mockImplementation((options) => {
            receivedOptions = options
            return { $disconnect: disconnectSpy }
        })

        process.env.PRISMA_LOG_QUERIES = undefined
        process.env.NODE_ENV = 'development'

        await loadPrismaModule()

        expect(receivedOptions).toEqual({ log: ['error', 'warn'] })
    })

    it('limits logging and disconnects gracefully in production', async () => {
        const disconnectSpy = vi.fn()
        let receivedOptions: any
        let beforeExitHandler: (() => Promise<void> | void) | undefined

        PrismaClientMock.mockImplementation((options) => {
            receivedOptions = options
            return { $disconnect: disconnectSpy }
        })

        const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
            if (event === 'beforeExit') {
                beforeExitHandler = handler as () => Promise<void> | void
            }
            return process
        })

        process.env.PRISMA_LOG_QUERIES = undefined
        process.env.NODE_ENV = 'production'

        await loadPrismaModule()

        expect(receivedOptions).toEqual({ log: ['error'] })
        expect(onSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function))

        await beforeExitHandler?.()
        expect(disconnectSpy).toHaveBeenCalledTimes(1)

        onSpy.mockRestore()
    })
})

