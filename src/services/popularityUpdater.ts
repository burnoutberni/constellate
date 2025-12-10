/**
 * Popularity Score Updater
 * Background job that periodically recalculates and updates popularity scores
 * for all events. Popularity formula: attendance * 2 + likes
 */

import { prisma } from '../lib/prisma.js'

// Update interval: run every 5 minutes
const UPDATE_INTERVAL_MS = 5 * 60 * 1000

// Batch size for processing events
const BATCH_SIZE = 100

let updaterStarted = false
let isProcessing = false
let intervalHandle: NodeJS.Timeout | null = null

export function getIsProcessing() {
    return isProcessing
}

/**
 * Calculate popularity score for an event
 * Formula: attendance * 2 + likes
 */
function calculatePopularityScore(attendanceCount: number, likesCount: number): number {
    return attendanceCount * 2 + likesCount
}

/**
 * Update popularity scores for a batch of events
 */
async function updatePopularityBatch(eventIds: string[]) {
    if (eventIds.length === 0) {
        return
    }

    // Get counts for all events in the batch
    const [attendanceCounts, likesCounts] = await Promise.all([
        prisma.eventAttendance.groupBy({
            by: ['eventId'],
            where: { eventId: { in: eventIds } },
            _count: { eventId: true },
        }),
        prisma.eventLike.groupBy({
            by: ['eventId'],
            where: { eventId: { in: eventIds } },
            _count: { eventId: true },
        }),
    ])

    // Create maps for quick lookup
    const attendanceMap = new Map(attendanceCounts.map(a => [a.eventId, a._count.eventId]))
    const likesMap = new Map(likesCounts.map(l => [l.eventId, l._count.eventId]))

    // Update each event's popularity score
    const updates = eventIds.map(async (eventId) => {
        const attendanceCount = attendanceMap.get(eventId) ?? 0
        const likesCount = likesMap.get(eventId) ?? 0
        const popularityScore = calculatePopularityScore(attendanceCount, likesCount)

        return prisma.event.update({
            where: { id: eventId },
            data: { popularityScore },
        })
    })

    await Promise.all(updates)
}

/**
 * Run a single update cycle for popularity scores
 */
export async function runPopularityUpdateCycle() {
    if (isProcessing) {
        return
    }

    isProcessing = true
    const startTime = Date.now()

    try {
        // Get all event IDs in batches
        let offset = 0
        let hasMore = true
        let totalUpdated = 0

        while (hasMore) {
            const events = await prisma.event.findMany({
                select: { id: true },
                skip: offset,
                take: BATCH_SIZE,
            })

            if (events.length === 0) {
                break
            }

            const eventIds = events.map(e => e.id)
            await updatePopularityBatch(eventIds)
            totalUpdated += eventIds.length

            offset += BATCH_SIZE
            hasMore = events.length === BATCH_SIZE

            // Small delay between batches to avoid overwhelming the database
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        const duration = Date.now() - startTime
        console.log(`✅ Popularity scores updated: ${totalUpdated} events in ${duration}ms`)
    } catch (error) {
        console.error('Error updating popularity scores:', error)
    } finally {
        isProcessing = false
    }
}

/**
 * Start the popularity updater background job
 */
export function startPopularityUpdater() {
    if (updaterStarted) {
        return
    }

    updaterStarted = true
    const runCycle = () => {
        void runPopularityUpdateCycle()
    }

    intervalHandle = setInterval(runCycle, UPDATE_INTERVAL_MS)
    runCycle() // Run immediately on startup
    console.log('📊 Popularity updater started')
}

/**
 * Stop the popularity updater background job
 */
export function stopPopularityUpdater() {
    if (intervalHandle) {
        clearInterval(intervalHandle)
        intervalHandle = null
    }
    updaterStarted = false
}

/**
 * Update popularity score for a specific event
 * Useful for real-time updates when attendance or likes change
 */
export async function updateEventPopularityScore(eventId: string) {
    try {
        const [attendanceCount, likesCount] = await Promise.all([
            prisma.eventAttendance.count({ where: { eventId } }),
            prisma.eventLike.count({ where: { eventId } }),
        ])

        const popularityScore = calculatePopularityScore(attendanceCount, likesCount)

        await prisma.event.update({
            where: { id: eventId },
            data: { popularityScore },
        })
    } catch (error) {
        console.error(`Error updating popularity score for event ${eventId}:`, error)
    }
}
