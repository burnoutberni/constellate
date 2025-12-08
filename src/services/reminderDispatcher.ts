import { NotificationType, ReminderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createNotification } from './notifications.js'
import { config } from '../config.js'
import { sendEmail } from '../lib/email.js'

const POLL_INTERVAL_MS = 30000
const PROCESSING_LIMIT = 25

let dispatcherStarted = false
let isProcessing = false
let intervalHandle: NodeJS.Timeout | null = null

function buildEventUrl(event: { id: string; user: { username?: string | null } | null }) {
    if (event.user?.username) {
        return `${config.baseUrl}/@${event.user.username}/${event.id}`
    }
    return `${config.baseUrl}/events/${event.id}`
}

function formatEventStart(startTime: Date) {
    try {
        return startTime.toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
        })
    } catch {
        return startTime.toISOString()
    }
}

async function processReminder(reminderId: string) {
    const now = new Date()
    const claimed = await prisma.eventReminder.updateMany({
        where: {
            id: reminderId,
            status: ReminderStatus.PENDING,
        },
        data: {
            status: ReminderStatus.SENDING,
            lastAttemptAt: now,
        },
    })

    if (claimed.count === 0) {
        return
    }

    const reminder = await prisma.eventReminder.findUnique({
        where: { id: reminderId },
        include: {
            event: {
                select: {
                    id: true,
                    title: true,
                    startTime: true,
                    user: {
                        select: {
                            username: true,
                        },
                    },
                },
            },
            user: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    email: true,
                },
            },
        },
    })

    if (!reminder || !reminder.event || !reminder.user) {
        if (reminder) {
            try {
                await prisma.eventReminder.update({
                    where: { id: reminderId },
                    data: {
                        status: ReminderStatus.FAILED,
                        failureReason: 'Reminder missing event or user context',
                    },
                })
            } catch {
                // Reminder was deleted, ignore
            }
        }
        return
    }

    try {
        const eventUrl = buildEventUrl(reminder.event)
        const eventStartFormatted = formatEventStart(reminder.event.startTime)
        const reminderLabel = `Reminder: ${reminder.event.title}`

        await createNotification({
            userId: reminder.user.id,
            type: NotificationType.EVENT,
            title: reminderLabel,
            body: `"${reminder.event.title}" starts at ${eventStartFormatted}.`,
            contextUrl: eventUrl,
            data: {
                eventId: reminder.event.id,
                reminderId: reminder.id,
                remindAt: reminder.remindAt.toISOString(),
            },
        })

        if (reminder.user.email) {
            const greeting = reminder.user.name || reminder.user.username
            const textBody = `Hi ${greeting},\n\nThis is your reminder for "${reminder.event.title}".\n\nStart time: ${eventStartFormatted}\nReminder offset: ${reminder.minutesBeforeStart} minutes before start\n\nView event: ${eventUrl}\n\n— Constellate`

            await sendEmail({
                to: reminder.user.email,
                subject: reminderLabel,
                text: textBody,
            })
        }

        await prisma.eventReminder.update({
            where: { id: reminder.id },
            data: {
                status: ReminderStatus.SENT,
                deliveredAt: new Date(),
                failureReason: null,
            },
        })
    } catch (error) {
        console.error('Failed to deliver reminder, marking as FAILED:', error)
        await prisma.eventReminder.update({
            where: { id: reminder.id },
            data: {
                status: ReminderStatus.FAILED,
                failureReason: error instanceof Error ? error.message : 'Unknown error',
            },
        })
    }
}

export async function runReminderDispatcherCycle(limit: number = PROCESSING_LIMIT) {
    if (isProcessing) {
        return
    }

    isProcessing = true
    try {
        const now = new Date()
        const reminders = await prisma.eventReminder.findMany({
            where: {
                status: ReminderStatus.PENDING,
                remindAt: {
                    lte: now,
                },
            },
            orderBy: { remindAt: 'asc' },
            take: limit,
        })

        // Process reminders concurrently to avoid blocking on slow operations
        // Use Promise.allSettled to ensure all reminders are processed even if some fail
        await Promise.allSettled(reminders.map((reminder) => processReminder(reminder.id)))
    } catch (error) {
        console.error('Reminder dispatcher error:', error)
    } finally {
        isProcessing = false
    }
}

export function startReminderDispatcher() {
    if (dispatcherStarted) {
        return
    }

    dispatcherStarted = true
    const runCycle = () => {
        void runReminderDispatcherCycle()
    }

    intervalHandle = setInterval(runCycle, POLL_INTERVAL_MS)
    runCycle()
    console.log('⏰ Reminder dispatcher started')
}

export function stopReminderDispatcher() {
    if (intervalHandle) {
        clearInterval(intervalHandle)
        intervalHandle = null
    }
    dispatcherStarted = false
}
