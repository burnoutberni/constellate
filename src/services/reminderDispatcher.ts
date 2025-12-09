import { NotificationType, ReminderStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createNotification } from './notifications.js'
import { config } from '../config.js'
import { sendEmail } from '../lib/email.js'

const POLL_INTERVAL_MS = 30000
const PROCESSING_LIMIT = 25

let dispatcherStarted = false
let isProcessing = false
let intervalHandle: NodeJS.Timeout | null = null

export function getIsProcessing() {
    return isProcessing
}

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
    // Reminder has already been claimed and set to SENDING in the transaction
    // Just verify it still exists and is in SENDING status

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

    let notificationSucceeded = false
    let notificationError: Error | null = null
    let emailError: Error | null = null

    try {
        const eventUrl = buildEventUrl(reminder.event)
        const eventStartFormatted = formatEventStart(reminder.event.startTime)
        const reminderLabel = `Reminder: ${reminder.event.title}`

        // Try to create notification
        try {
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
            notificationSucceeded = true
        } catch (error) {
            notificationError = error instanceof Error ? error : new Error(String(error))
            console.error('Failed to create notification for reminder:', error)
        }

        // Try to send email (non-critical, don't fail if this fails)
        if (reminder.user.email) {
            try {
                const greeting = reminder.user.name || reminder.user.username
                const textBody = `Hi ${greeting},\n\nThis is your reminder for "${reminder.event.title}".\n\nStart time: ${eventStartFormatted}\nReminder offset: ${reminder.minutesBeforeStart} minutes before start\n\nView event: ${eventUrl}\n\n— Constellate`

                await sendEmail({
                    to: reminder.user.email,
                    subject: reminderLabel,
                    text: textBody,
                })
            } catch (error) {
                emailError = error instanceof Error ? error : new Error(String(error))
                console.warn('Failed to send email for reminder (non-critical):', error)
            }
        }

        // Determine final status based on what succeeded
        if (notificationSucceeded) {
            // Notification succeeded - reminder is considered sent
            // Email failure is non-critical and logged as a warning
            await prisma.eventReminder.update({
                where: { id: reminder.id },
                data: {
                    status: ReminderStatus.SENT,
                    deliveredAt: new Date(),
                    failureReason: emailError ? `Email failed: ${emailError.message}` : null,
                },
            })
        } else {
            // Notification failed - mark as failed
            await prisma.eventReminder.update({
                where: { id: reminder.id },
                data: {
                    status: ReminderStatus.FAILED,
                    failureReason: notificationError?.message || 'Unknown error',
                },
            })
        }
    } catch (error) {
        // Unexpected error during processing
        console.error('Unexpected error processing reminder, marking as FAILED:', error)
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
        // Use a transaction with FOR UPDATE SKIP LOCKED to atomically select and claim reminders
        // This prevents race conditions when multiple dispatcher instances run simultaneously
        const reminderIds = await prisma.$transaction(async (tx) => {
            // Select and lock reminders atomically
            const reminders = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id
                FROM "EventReminder"
                WHERE status = ${ReminderStatus.PENDING}::"ReminderStatus"
                  AND "remindAt" <= ${now}
                ORDER BY "remindAt" ASC
                LIMIT ${limit}
                FOR UPDATE SKIP LOCKED
            `

            // Immediately update status to SENDING to claim them
            if (reminders.length > 0) {
                const ids = reminders.map(r => r.id)
                await tx.$executeRaw(
                    Prisma.sql`
                        UPDATE "EventReminder"
                        SET status = ${ReminderStatus.SENDING}::"ReminderStatus",
                            "lastAttemptAt" = ${now}
                        WHERE id = ANY(${ids}::text[])
                          AND status = ${ReminderStatus.PENDING}::"ReminderStatus"
                    `
                )
            }

            return reminders.map(r => r.id)
        })

        // Process reminders concurrently to avoid blocking on slow operations
        // Use Promise.allSettled to ensure all reminders are processed even if some fail
        await Promise.allSettled(reminderIds.map((reminderId) => processReminder(reminderId)))
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
