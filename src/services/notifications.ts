import type { NotificationType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { sanitizeText } from '../lib/sanitization.js'
import { broadcastToUser, BroadcastEvents } from '../realtime.js'

const actorSelect = {
    id: true,
    username: true,
    name: true,
    displayColor: true,
    profileImage: true,
} as const

export const notificationInclude = {
    actor: {
        select: actorSelect,
    },
} as const

export type NotificationWithActor = Prisma.NotificationGetPayload<{
    include: typeof notificationInclude
}>

export type CreateNotificationInput = {
    userId: string
    actorId?: string
    type: NotificationType
    title: string
    body?: string
    contextUrl?: string
    data?: Record<string, unknown>
}

function sanitizeOptionalText(value?: string | null): string | null {
    return value ? sanitizeText(value) : null
}

function toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) {
        return null
    }
    return typeof value === 'string' ? value : value.toISOString()
}

export function serializeNotification(notification: NotificationWithActor) {
    const createdAt = toIsoString(notification.createdAt) ?? new Date().toISOString()
    const updatedAt = toIsoString(notification.updatedAt) ?? createdAt

    return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        contextUrl: notification.contextUrl,
        data: notification.data ?? null,
        read: notification.read,
        readAt: toIsoString(notification.readAt),
        createdAt,
        updatedAt,
        actor: notification.actor
            ? {
                  id: notification.actor.id,
                  username: notification.actor.username,
                  name: notification.actor.name,
                  displayColor: notification.actor.displayColor,
                  profileImage: notification.actor.profileImage,
              }
            : null,
    }
}

export async function createNotification(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
        data: {
            userId: input.userId,
            actorId: input.actorId ?? null,
            type: input.type,
            title: sanitizeText(input.title),
            body: sanitizeOptionalText(input.body),
            contextUrl: input.contextUrl ?? null,
            data: (input.data ?? null) as Prisma.JsonValue,
        },
        include: notificationInclude,
    })

    await broadcastToUser(input.userId, {
        type: BroadcastEvents.NOTIFICATION_CREATED,
        data: {
            notification: serializeNotification(notification),
        },
    })

    return notification
}

export async function listNotifications(userId: string, limit = 20) {
    const safeLimit = Math.max(1, Math.min(limit, 100))

    const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        include: notificationInclude,
    })

    return notifications
}

export async function getUnreadNotificationCount(userId: string) {
    return prisma.notification.count({
        where: {
            userId,
            read: false,
        },
    })
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            userId,
        },
        include: notificationInclude,
    })

    if (!existing) {
        return null
    }

    if (existing.read) {
        return existing
    }

    const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
            read: true,
            readAt: new Date(),
        },
        include: notificationInclude,
    })

    await broadcastToUser(userId, {
        type: BroadcastEvents.NOTIFICATION_READ,
        data: {
            notification: serializeNotification(updated),
        },
    })

    return updated
}

export async function markAllNotificationsRead(userId: string) {
    const result = await prisma.notification.updateMany({
        where: {
            userId,
            read: false,
        },
        data: {
            read: true,
            readAt: new Date(),
        },
    })

    if (result.count > 0) {
        await broadcastToUser(userId, {
            type: BroadcastEvents.NOTIFICATION_READ,
            data: {
                allRead: true,
                count: result.count,
            },
        })
    }

    return result.count
}
