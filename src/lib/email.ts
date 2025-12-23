import * as nodemailer from 'nodemailer'
import DOMPurify from 'isomorphic-dompurify'
import { config } from '../config.js'
function replaceEmailPlaceholders(html: string): string {
	const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.replace(/\/$/, '') : ''
	return html
		.replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, baseUrl ? `${baseUrl}/email/unsubscribe` : '#')
		.replace(
			/\{\{\{PREFERENCES_URL\}\}\}/g,
			baseUrl ? `${baseUrl}/settings/email-preferences` : '#'
		)
		.replace(/\{\{\{NOTIFICATIONS_URL\}\}\}/g, baseUrl ? `${baseUrl}/notifications` : '#')
}
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

	const htmlWithUrls = replaceEmailPlaceholders(html)

	const result = await sendEmail({
		to,
		subject,
		text: text || generateTextFromHtml(htmlWithUrls),
		html: htmlWithUrls,
	})

	// Store email delivery record only after successful send
	if (userId && result) {
		try {
			await prisma.emailDelivery.create({
				data: {
					userId,
					to,
					templateName,
					subject,
					status: 'SENT',
					sentAt: new Date(),
					messageId: result.messageId,
				},
			})
		} catch (error) {
			console.error('⚠️ Failed to record email delivery:', error)
			// Don't fail the email send if we can't record it
		}
	}

	return result
}

/**
 * Generate plain text from HTML (basic implementation)
 */
function generateTextFromHtml(html: string): string {
	// Sanitize HTML first to prevent XSS and ensure safe processing
	const sanitized = DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [], // Strip all HTML tags
		ALLOWED_ATTR: [], // No attributes allowed
	})

	// Decode HTML entities and clean up whitespace
	return sanitized
		.replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
		.replace(/&lt;/g, '<') // Decode HTML entities
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&') // Decode ampersand last to avoid double unescaping
		.replace(/[<>]/g, '') // Remove any remaining < and > to prevent reintroduced tags
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
	data?: Record<string, unknown>
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

	try {
		return await sendTemplatedEmail({
			to: user.email,
			subject: title,
			html,
			templateName: `notification_${type.toLowerCase()}`,
			userId,
		})
	} catch (error) {
		console.error('Failed to send email notification:', error)
		// Don't re-throw - notification failures shouldn't break the app
	}
}
