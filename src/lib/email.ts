import * as nodemailer from 'nodemailer'
import { config } from '../config.js'
import { prisma } from './prisma.js'
import { type NotificationType } from '@prisma/client'

const transporter = nodemailer.createTransport({
	host: config.smtp.host,
	port: config.smtp.port,
	secure: config.smtp.secure,
	auth: {
		user: config.smtp.user,
		pass: config.smtp.pass,
	},
})

export async function sendEmail({
	to,
	subject,
	text,
	html,
}: {
	to: string
	subject: string
	text: string
	html?: string
}) {
	if (!config.smtp.host) {
		console.log('⚠️ SMTP not configured, skipping email sending')
		console.log(`To: ${to}`)
		console.log(`Subject: ${subject}`)
		console.log(`Text: ${text}`)
		if (html) {
			console.log(`HTML: ${html}`)
		}
		return
	}

	try {
		const info = await transporter.sendMail({
			from: config.smtp.from,
			to,
			subject,
			text,
			html,
		})
		console.log(`📧 Email sent: ${info.messageId}`)
		return info
	} catch (error) {
		console.error('❌ Error sending email:', error)
		throw error
	}
}

/**
 * Send email using a template
 */
export async function sendTemplatedEmail({
	to,
	subject,
	html,
	text,
	templateName,
	userId,
}: {
	to: string
	subject: string
	html: string
	text?: string
	templateName: string
	userId?: string
}) {
	// Log email sending for analytics and debugging
	console.log(`📧 Sending email template: ${templateName} to ${to}`)

	// Store email delivery record if userId provided
	if (userId) {
		try {
			await prisma.emailDelivery.create({
				data: {
					userId,
					to,
					templateName,
					subject,
					status: 'SENT',
					sentAt: new Date(),
				},
			})
		} catch (error) {
			console.error('⚠️ Failed to record email delivery:', error)
			// Don't fail the email send if we can't record it
		}
	}

	return sendEmail({
		to,
		subject,
		text: text || generateTextFromHtml(html),
		html,
	})
}

/**
 * Generate plain text from HTML (basic implementation)
 */
function generateTextFromHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, '') // Remove HTML tags
		.replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
		.replace(/&amp;/g, '&') // Replace HTML entities
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Check if user has email notifications enabled for a specific type
 */
export async function getUserEmailPreference(
	userId: string,
	type: NotificationType
): Promise<boolean> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { emailNotifications: true },
		})

		if (!user?.emailNotifications) {
			// Default to enabled if no preferences set
			return true
		}

		const preferences = user.emailNotifications as Record<string, boolean>
		return preferences[type] !== false // Default to true unless explicitly disabled
	} catch (error) {
		console.error('Error checking email preferences:', error)
		return true // Default to enabled on error
	}
}

/**
 * Send notification email if user has it enabled
 */
export async function sendNotificationEmail({
	userId,
	type,
	title,
	body,
	contextUrl,
	actorName,
	actorUrl,
	data,
}: {
	userId: string
	type: NotificationType
	title: string
	body?: string
	contextUrl?: string
	actorName?: string
	actorUrl?: string
	data?: Record<string, any>
}) {
	// Check if user has this email notification type enabled
	const isEnabled = await getUserEmailPreference(userId, type)
	if (!isEnabled) {
		console.log(`📧 Email notifications disabled for ${type}, skipping`)
		return
	}

	// Get user details
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true, name: true, username: true },
	})

	if (!user?.email) {
		console.log(`📧 User ${userId} has no email address, skipping notification`)
		return
	}

	// Import the notification template
	const { NotificationEmailTemplate } = await import('./email/templates/notifications.js')

	const html = NotificationEmailTemplate({
		userName: user.name || user.username,
		type,
		title,
		body,
		contextUrl,
		actorName,
		actorUrl,
		data,
	})

	return sendTemplatedEmail({
		to: user.email,
		subject: title,
		html,
		templateName: `notification_${type.toLowerCase()}`,
		userId,
	})
}
