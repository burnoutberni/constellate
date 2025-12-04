/**
 * Real-time Updates with Server-Sent Events (SSE)
 * Broadcasts updates to all connected clients
 */


import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { requireAuth } from './middleware/auth.js'

const app = new Hono()


interface SSEStream {
    writeSSE(message: { data: string; event?: string; id?: string; retry?: number }): Promise<void>
    sleep(ms: number): Promise<unknown>
    close(): Promise<void>
}

// Connected clients registry
interface Client {
    id: string
    userId: string // Now required
    stream: SSEStream // Hono SSE stream
}

const clients = new Map<string, Client>()

/**
 * SSE endpoint - clients connect here for real-time updates
 * Authentication required to prevent resource exhaustion
 */
app.get('/stream', moderateRateLimit, async (c) => {
    // Require authentication
    const userId = requireAuth(c)
    const clientId = crypto.randomUUID()


    return streamSSE(c, async (stream: SSEStream) => {
        // Store client
        const client: Client = {
            id: clientId,
            userId,
            stream,
        }
        clients.set(clientId, client)

        console.log(`✅ SSE client connected: ${clientId} (user: ${userId})`)


        // Send initial connection message
        await stream.writeSSE({
            data: JSON.stringify({
                type: 'connected',
                clientId,
                timestamp: new Date().toISOString(),
            }),
            event: 'connected',
        })

        // Keep connection alive with heartbeat
        const heartbeatInterval = setInterval(async () => {
            try {
                await stream.writeSSE({
                    data: JSON.stringify({ type: 'heartbeat' }),
                    event: 'heartbeat',
                })
            } catch {
                console.log(`❌ Heartbeat failed for client ${clientId}`)
                clearInterval(heartbeatInterval)
                clients.delete(clientId)
            }
        }, 30000) // Every 30 seconds

        // Handle client disconnect
        c.req.raw.signal.addEventListener('abort', () => {
            console.log(`❌ SSE client disconnected: ${clientId}`)
            clearInterval(heartbeatInterval)
            clients.delete(clientId)
        })

        // Keep the stream open with a loop
        while (!c.req.raw.signal.aborted) {
            await stream.sleep(1000)
        }
    })
})

/**
 * Broadcast event to all connected clients
 */
export async function broadcast(event: {
    type: string
    data: Record<string, unknown>
    userId?: string
    targetUserId?: string // If set, only send to this specific user's clients
}) {
    const message = {
        ...event,
        timestamp: new Date().toISOString(),
    }

    const totalClients = clients.size
    console.log(`📡 Broadcasting ${event.type} to ${totalClients} connected clients`)

    let successCount = 0
    let failCount = 0

    const promises = Array.from(clients.entries()).map(async ([id, client]) => {
        try {
            // Send to all clients, or filter by targetUserId if specified
            // Note: event.userId is the user who performed the action (included in data)
            // targetUserId is for filtering which clients receive the event
            if (!event.targetUserId || client.userId === event.targetUserId) {
                await client.stream.writeSSE({
                    data: JSON.stringify(message),
                    event: event.type,
                })
                successCount++
            } else {
                console.log(`⏭️  Skipping client ${id} (userId: ${client.userId}, targetUserId: ${event.targetUserId})`)
            }
        } catch (error) {
            console.error(`Failed to send to client ${id}:`, error)
            clients.delete(id)
            failCount++
        }
    })

    await Promise.all(promises)

    if (successCount > 0 || failCount > 0) {
        console.log(
            `📡 Broadcast ${event.type}: ${successCount} sent, ${failCount} failed (${totalClients} total clients)`
        )
    } else if (totalClients === 0) {
        console.log(`⚠️  No clients connected to receive ${event.type}`)
    }
}

/**
 * Broadcast to specific user's clients
 */
export async function broadcastToUser(userId: string, event: { type: string; data: Record<string, unknown> }) {
    const { type, data } = event

    let count = 0
    const promises = Array.from(clients.entries()).map(async ([clientId, client]) => {
        if (client.userId === userId) {
            try {
                // We can't easily type the stream write method without Hono's internal types
                const stream = client.stream
                await stream.writeSSE({
                    data: JSON.stringify(data),
                    event: type,
                    id: String(Date.now()),
                })
                count++
            } catch (error) {
                console.error(`Failed to send to client ${clientId}:`, error)
                clients.delete(clientId)
            }
        }
    })

    await Promise.all(promises)

    if (count > 0) {
        console.log(`📡 Broadcast to user ${userId}: ${count} clients`)
    }
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
    return clients.size
}

/**
 * Get connected clients for a user
 */
export function getUserClientCount(userId: string): number {
    let count = 0
    clients.forEach((client) => {
        if (client.userId === userId) {
            count++
        }
    })
    return count
}

// Event type helpers for type safety
export const BroadcastEvents = {
    // Event updates
    EVENT_CREATED: 'event:created',
    EVENT_UPDATED: 'event:updated',
    EVENT_DELETED: 'event:deleted',

    // Attendance updates
    ATTENDANCE_ADDED: 'attendance:added',
    ATTENDANCE_UPDATED: 'attendance:updated',
    ATTENDANCE_REMOVED: 'attendance:removed',

    // Like updates
    LIKE_ADDED: 'like:added',
    LIKE_REMOVED: 'like:removed',

    // Comment updates
    COMMENT_ADDED: 'comment:added',
    COMMENT_DELETED: 'comment:deleted',

    // Profile updates
    PROFILE_UPDATED: 'profile:updated',

    // Follow updates
    FOLLOW_ADDED: 'follow:added',
    FOLLOW_REMOVED: 'follow:removed',
    FOLLOW_ACCEPTED: 'follow:accepted',
    FOLLOW_PENDING: 'follow:pending',
    FOLLOW_REJECTED: 'follow:rejected',
    FOLLOWER_ADDED: 'follower:added',
    FOLLOWER_REMOVED: 'follower:removed',
} as const

export default app
