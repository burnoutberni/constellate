/**
 * Database test helpers
 * Provides utilities for setting up and tearing down test databases
 */

import { prisma } from '../../lib/prisma.js'

/**
 * Clean up test data
 * Removes all test data from the database
 */
export async function cleanupTestData() {
    await prisma.$transaction([
        prisma.apiKey.deleteMany(),
        prisma.account.deleteMany(),
        prisma.session.deleteMany(),
        prisma.verification.deleteMany(),
        prisma.eventAttendance.deleteMany(),
        prisma.eventLike.deleteMany(),
        prisma.comment.deleteMany(),
        prisma.eventTag.deleteMany(),
        prisma.inboxItem.deleteMany(),
        prisma.processedActivity.deleteMany(),
        prisma.report.deleteMany(),
        prisma.blockedUser.deleteMany(),
        prisma.blockedDomain.deleteMany(),
        prisma.following.deleteMany(),
        prisma.follower.deleteMany(),
        prisma.event.deleteMany(),
        prisma.user.deleteMany(),
    ])
}

/**
 * Create a test user
 */
export async function createTestUser(data?: {
    username?: string
    email?: string
    name?: string
    isAdmin?: boolean
}) {
    return await prisma.user.create({
        data: {
            username: data?.username || `testuser_${Date.now()}`,
            email: data?.email || `test_${Date.now()}@example.com`,
            name: data?.name || 'Test User',
            isAdmin: data?.isAdmin || false,
        },
    })
}

/**
 * Create a test event
 */
export async function createTestEvent(data?: {
    userId: string
    title?: string
    startTime?: Date
    endTime?: Date
}) {
    return await prisma.event.create({
        data: {
            userId: data?.userId,
            title: data?.title || 'Test Event',
            startTime: data?.startTime || new Date(),
            endTime: data?.endTime,
            attributedTo: `https://example.com/users/${data?.userId}`,
        },
    })
}

/**
 * Create a test comment
 */
export async function createTestComment(data: {
    authorId: string
    eventId: string
    content?: string
    inReplyToId?: string | null
}) {
    return await prisma.comment.create({
        data: {
            authorId: data.authorId,
            eventId: data.eventId,
            content: data.content || 'Test comment',
            inReplyToId: data.inReplyToId || null,
        },
    })
}

/**
 * Create a test attendance
 */
export async function createTestAttendance(data: {
    userId: string
    eventId: string
    status?: 'attending' | 'maybe' | 'not_attending'
}) {
    return await prisma.eventAttendance.create({
        data: {
            userId: data.userId,
            eventId: data.eventId,
            status: data.status || 'attending',
        },
    })
}

/**
 * Create a test like
 */
export async function createTestLike(data: {
    userId: string
    eventId: string
}) {
    return await prisma.eventLike.create({
        data: {
            userId: data.userId,
            eventId: data.eventId,
        },
    })
}

/**
 * Create a test follow relationship
 */
export async function createTestFollow(data: {
    followerId: string
    followingId: string
}) {
    // Note: This is a simplified helper. In reality, Following requires actorUrl, username, etc.
    // This function may need to be updated to match the actual Following model structure
    return await (prisma as any).following.create({
        data: {
            userId: data.followerId,
            actorUrl: `https://example.com/users/${data.followingId}`,
            username: `user_${data.followingId}`,
            inboxUrl: `https://example.com/users/${data.followingId}/inbox`,
            accepted: true,
        },
    })
}

