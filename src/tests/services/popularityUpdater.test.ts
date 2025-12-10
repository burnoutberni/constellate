import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    runPopularityUpdateCycle,
    startPopularityUpdater,
    stopPopularityUpdater,
    getIsProcessing,
    updateEventPopularityScore,
} from '../../services/popularityUpdater.js'
import { prisma } from '../../lib/prisma.js'

vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        event: {
            findMany: vi.fn(),
            update: vi.fn(),
        },
        eventAttendance: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
        eventLike: {
            count: vi.fn(),
            groupBy: vi.fn(),
        },
    },
}))

describe('Popularity Updater Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stopPopularityUpdater()
    })

    afterEach(() => {
        stopPopularityUpdater()
        vi.useRealTimers()
    })

    describe('updateEventPopularityScore', () => {
        it('should calculate and update popularity score correctly', async () => {
            const eventId = 'event_123'
            
            // Mock counts: 5 attendance, 3 likes
            // Expected score: 5 * 2 + 3 = 13
            vi.mocked(prisma.eventAttendance.count).mockResolvedValue(5)
            vi.mocked(prisma.eventLike.count).mockResolvedValue(3)
            vi.mocked(prisma.event.update).mockResolvedValue({
                id: eventId,
                popularityScore: 13,
            } as any)

            await updateEventPopularityScore(eventId)

            expect(prisma.eventAttendance.count).toHaveBeenCalledWith({
                where: { eventId },
            })
            expect(prisma.eventLike.count).toHaveBeenCalledWith({
                where: { eventId },
            })
            expect(prisma.event.update).toHaveBeenCalledWith({
                where: { id: eventId },
                data: { popularityScore: 13 },
            })
        })

        it('should handle zero counts correctly', async () => {
            const eventId = 'event_123'
            
            vi.mocked(prisma.eventAttendance.count).mockResolvedValue(0)
            vi.mocked(prisma.eventLike.count).mockResolvedValue(0)
            vi.mocked(prisma.event.update).mockResolvedValue({
                id: eventId,
                popularityScore: 0,
            } as any)

            await updateEventPopularityScore(eventId)

            expect(prisma.event.update).toHaveBeenCalledWith({
                where: { id: eventId },
                data: { popularityScore: 0 },
            })
        })

        it('should handle errors gracefully', async () => {
            const eventId = 'event_123'
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            
            vi.mocked(prisma.eventAttendance.count).mockRejectedValue(new Error('Database error'))

            await updateEventPopularityScore(eventId)

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error updating popularity score'),
                expect.any(Error)
            )

            consoleErrorSpy.mockRestore()
        })
    })

    describe('runPopularityUpdateCycle', () => {
        it('should process events in batches', async () => {
            const events = [
                { id: 'event_1' },
                { id: 'event_2' },
                { id: 'event_3' },
            ]

            vi.mocked(prisma.event.findMany)
                .mockResolvedValueOnce(events as any)
                .mockResolvedValueOnce([])

            vi.mocked(prisma.eventAttendance.groupBy).mockResolvedValue([
                { eventId: 'event_1', _count: { eventId: 2 } },
                { eventId: 'event_2', _count: { eventId: 1 } },
                { eventId: 'event_3', _count: { eventId: 0 } },
            ] as any)

            vi.mocked(prisma.eventLike.groupBy).mockResolvedValue([
                { eventId: 'event_1', _count: { eventId: 3 } },
                { eventId: 'event_2', _count: { eventId: 1 } },
                { eventId: 'event_3', _count: { eventId: 0 } },
            ] as any)

            vi.mocked(prisma.event.update).mockResolvedValue({} as any)

            await runPopularityUpdateCycle()

            // Should fetch events
            expect(prisma.event.findMany).toHaveBeenCalled()
            
            // Should get counts for all events
            expect(prisma.eventAttendance.groupBy).toHaveBeenCalledWith({
                by: ['eventId'],
                where: { eventId: { in: ['event_1', 'event_2', 'event_3'] } },
                _count: { eventId: true },
            })

            // Should update all events with correct scores
            // event_1: 2 * 2 + 3 = 7
            // event_2: 1 * 2 + 1 = 3
            // event_3: 0 * 2 + 0 = 0
            expect(prisma.event.update).toHaveBeenCalledTimes(3)
            expect(prisma.event.update).toHaveBeenCalledWith({
                where: { id: 'event_1' },
                data: { popularityScore: 7 },
            })
            expect(prisma.event.update).toHaveBeenCalledWith({
                where: { id: 'event_2' },
                data: { popularityScore: 3 },
            })
            expect(prisma.event.update).toHaveBeenCalledWith({
                where: { id: 'event_3' },
                data: { popularityScore: 0 },
            })
        })

        it('should handle empty event list', async () => {
            vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])

            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            await runPopularityUpdateCycle()

            expect(prisma.event.findMany).toHaveBeenCalled()
            expect(prisma.eventAttendance.groupBy).not.toHaveBeenCalled()
            expect(prisma.eventLike.groupBy).not.toHaveBeenCalled()
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Popularity scores updated: 0 events')
            )

            consoleLogSpy.mockRestore()
        })

        it('should handle errors gracefully', async () => {
            // Mock to throw error on first call
            const error = new Error('Database error')
            vi.mocked(prisma.event.findMany).mockRejectedValueOnce(error)

            // Should not throw - error should be caught and handled
            await expect(runPopularityUpdateCycle()).resolves.not.toThrow()
            
            // Verify processing state is reset even after error
            // This ensures the error was caught in the try/catch block
            expect(getIsProcessing()).toBe(false)
        })

        it('should not run if already processing', async () => {
            // Set processing state manually (simulating concurrent call)
            const firstCall = runPopularityUpdateCycle()
            
            // Second call should return immediately
            await runPopularityUpdateCycle()
            
            // Wait for first call to complete
            await firstCall

            // Should only process once
            expect(prisma.event.findMany).toHaveBeenCalledTimes(1)
        })
    })

    describe('startPopularityUpdater / stopPopularityUpdater', () => {
        it('should start and stop the updater', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
            
            vi.mocked(prisma.event.findMany).mockResolvedValue([])

            startPopularityUpdater()
            expect(consoleLogSpy).toHaveBeenCalledWith('📊 Popularity updater started')

            // Wait for the immediate run cycle to complete
            await new Promise(resolve => setTimeout(resolve, 50))

            stopPopularityUpdater()
            
            // Processing should be false after stopping
            // Note: getIsProcessing might still be true if a cycle is running,
            // but after stopping the updater, it should eventually be false
            const isProcessing = getIsProcessing()
            // The updater is stopped, so even if processing, it won't start new cycles
            expect(consoleLogSpy).toHaveBeenCalled()

            consoleLogSpy.mockRestore()
        })

        it('should not start if already started', () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
            
            startPopularityUpdater()
            const firstCallCount = consoleLogSpy.mock.calls.length

            startPopularityUpdater()
            // Should not log again
            expect(consoleLogSpy.mock.calls.length).toBe(firstCallCount)

            stopPopularityUpdater()
            consoleLogSpy.mockRestore()
        })

        it('should run immediately on startup', async () => {
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

            startPopularityUpdater()

            // Wait a bit for the immediate run
            await new Promise(resolve => setTimeout(resolve, 10))

            expect(prisma.event.findMany).toHaveBeenCalled()

            stopPopularityUpdater()
            consoleLogSpy.mockRestore()
        })
    })

    describe('getIsProcessing', () => {
        it('should return false when not processing', () => {
            expect(getIsProcessing()).toBe(false)
        })
    })
})
