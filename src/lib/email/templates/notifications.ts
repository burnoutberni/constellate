/**
 * Email Notification Templates
 * Templates for different types of email notifications
 */

import { BaseEmailTemplate, EmailButton, EmailCard } from './base.js'
import DOMPurify from 'isomorphic-dompurify'

export interface NotificationEmailProps {
	/** Recipient's display name */
	userName?: string
	/** Type of notification */
	type: 'FOLLOW' | 'COMMENT' | 'LIKE' | 'MENTION' | 'EVENT' | 'SYSTEM'
	/** Notification title */
	title: string
	/** Notification body/content */
	body?: string
	/** URL to view the notification in context */
	contextUrl?: string
	/** Actor who triggered the notification */
	actorName?: string
	/** Actor's profile URL */
	actorUrl?: string
	/** Additional notification data */
	data?: Record<string, unknown>
}

function getNotificationIcon(type: string): string {
	const icons = {
		FOLLOW: '👥',
		COMMENT: '💬',
		LIKE: '❤️',
		MENTION: '@️⃣',
		EVENT: '📅',
		SYSTEM: '⚙️',
	}
	return icons[type as keyof typeof icons] || '📬'
}

function getNotificationColor(type: string): string {
	const colors = {
		FOLLOW: '#10b981', // green
		COMMENT: '#3b82f6', // blue
		LIKE: '#ef4444', // red
		MENTION: '#8b5cf6', // purple
		EVENT: '#f59e0b', // amber
		SYSTEM: '#6b7280', // gray
	}
	return colors[type as keyof typeof colors] || '#3b82f6'
}

export function NotificationEmailTemplate({
	userName,
	type,
	title,
	body,
	contextUrl,
	actorName,
	actorUrl,
	data,
}: NotificationEmailProps) {
	const icon = getNotificationIcon(type)
	const color = getNotificationColor(type)

	// Sanitize user-provided content
	const safeTitle = DOMPurify.sanitize(title)
	const safeActorName = actorName ? DOMPurify.sanitize(actorName) : ''
	const safeActorUrl = actorUrl ? DOMPurify.sanitize(actorUrl) : ''
	const safeBody = body ? DOMPurify.sanitize(body) : ''
	const safeContextUrl = contextUrl ? DOMPurify.sanitize(contextUrl) : ''

	const subject = safeTitle
	const previewText = safeBody || `New ${type.toLowerCase()} notification on Constellate`

	const content = `
		   <div style="display: flex; align-items: center; margin-bottom: 20px;">
			   <div style="font-size: 24px; margin-right: 12px;">${icon}</div>
			   <div>
				   <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">${safeTitle}</h3>
				   ${actorName ? `<p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">from ${safeActorName}</p>` : ''}
				   ${actorUrl ? `<p style="margin: 0; color: #64748b; font-size: 13px;"><a href="${safeActorUrl}" style="color: #3b82f6; text-decoration: underline;">View profile</a></p>` : ''}
			   </div>
		   </div>
    
		${body ? `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${safeBody}</p>` : ''}
    
		${
			contextUrl
				? `
			<div style="text-align: center; margin: 32px 0;">
				${EmailButton({
					children: 'View on Constellate',
					href: safeContextUrl,
					variant: 'primary',
					fullWidth: true,
				})}
			</div>
		`
				: ''
		}
    
		<!-- Type-specific content -->
		${getTypeSpecificContent(type, data, safeContextUrl)}
    
		<p style="color: #64748b; font-size: 14px; font-style: italic; margin-top: 24px;">
			You received this notification because you're subscribed to ${type.toLowerCase()} updates. 
			<a href="{{{PREFERENCES_URL}}}" style="color: ${color}; text-decoration: underline;">Manage your email preferences</a>.
		</p>
	`

	return BaseEmailTemplate({
		subject,
		previewText,
		userName,
		children: content,
		brandColor: color,
	})
}

function getTypeSpecificContent(
	type: string,
	data?: Record<string, unknown>,
	_contextUrl?: string
): string {
	switch (type) {
		case 'FOLLOW':
			return getFollowContent(data)
		case 'COMMENT':
			return getCommentContent(data)
		case 'LIKE':
			return getLikeContent(data)
		case 'MENTION':
			return getMentionContent(data)
		case 'EVENT':
			return getEventContent(data)
		case 'SYSTEM':
			return getSystemContent(data)
		default:
			return ''
	}
}

function getFollowContent(data?: Record<string, unknown>): string {
	const safeActorUsername = data?.actorUsername
		? DOMPurify.sanitize(String(data.actorUsername))
		: ''
	const safeActorBio = data?.actorBio ? DOMPurify.sanitize(String(data.actorBio)) : ''
	return `
		 ${EmailCard({
				title: 'New Follower',
				children: `
				 <p>You have a new follower! They'll now see your public events and updates in their feed.</p>
				 ${data?.actorUsername ? `<p><strong>Username:</strong> @${safeActorUsername}</p>` : ''}
				 ${data?.actorBio ? `<p><strong>Bio:</strong> ${safeActorBio}</p>` : ''}
			 `,
			})}
	 `
}

function getCommentContent(data?: Record<string, unknown>): string {
	const safeEventTitle = data?.eventTitle ? DOMPurify.sanitize(String(data.eventTitle)) : ''
	const safeCommentPreview = data?.commentPreview
		? DOMPurify.sanitize(String(data.commentPreview))
		: ''
	return `
		 ${EmailCard({
				title: 'New Comment',
				children: `
				 <p>Someone commented on your event.</p>
				 ${data?.eventTitle ? `<p>Event: ${safeEventTitle}</p>` : ''}
				 ${data?.commentPreview ? `<p><strong>Comment:</strong> "${safeCommentPreview}"</p>` : ''}
			 `,
			})}
	 `
}

function getLikeContent(data?: Record<string, unknown>): string {
	const safeEventTitle = data?.eventTitle ? DOMPurify.sanitize(String(data.eventTitle)) : ''
	const safeTotalLikes = data?.totalLikes ? DOMPurify.sanitize(String(data.totalLikes)) : ''
	return `
		 ${EmailCard({
				title: 'New Like',
				children: `
				 <p>Someone liked your event!</p>
				 ${data?.eventTitle ? `<p>Event: ${safeEventTitle}</p>` : ''}
				 ${data?.totalLikes ? `<p>Total likes: ${safeTotalLikes}</p>` : ''}
			 `,
			})}
	 `
}

function getMentionContent(data?: Record<string, unknown>): string {
	const safeEventTitle = data?.eventTitle ? DOMPurify.sanitize(String(data.eventTitle)) : ''
	const safeCommentPreview = data?.commentPreview
		? DOMPurify.sanitize(String(data.commentPreview))
		: ''
	return `
		 ${EmailCard({
				title: 'You were mentioned',
				children: `
				 <p>You were mentioned in a comment.</p>
				 ${data?.eventTitle ? `<p><strong>Event:</strong> ${safeEventTitle}</p>` : ''}
				 ${data?.commentPreview ? `<p><strong>Comment:</strong> "${safeCommentPreview}"</p>` : ''}
			 `,
			})}
	 `
}

function getEventContent(data?: Record<string, unknown>): string {
	const safeEventTitle = data?.eventTitle ? DOMPurify.sanitize(String(data.eventTitle)) : ''
	const safeEventDate = data?.eventDate
		? DOMPurify.sanitize(new Date(data.eventDate as string).toLocaleDateString())
		: ''
	const safeUpdateType = data?.updateType ? DOMPurify.sanitize(String(data.updateType)) : ''
	return `
		 ${EmailCard({
				title: 'Event Update',
				children: `
				 <p>There's an update for an event you're attending.</p>
				 ${data?.eventTitle ? `<p>Event: ${safeEventTitle}</p>` : ''}
				 ${data?.eventDate ? `<p>Date: ${safeEventDate}</p>` : ''}
				 ${data?.updateType ? `<p>Update: ${safeUpdateType}</p>` : ''}
			 `,
			})}
	 `
}

function getSystemContent(data?: Record<string, unknown>): string {
	const safeMessage = data?.message ? DOMPurify.sanitize(String(data.message)) : ''
	return `
		 ${EmailCard({
				title: 'System Notification',
				children: `
				 <p>This is an important update from the Constellate platform.</p>
				 ${data?.message ? `<p>${safeMessage}</p>` : ''}
				 ${data?.actionRequired ? '<p><strong>Action may be required.</strong></p>' : ''}
			 `,
			})}
	 `
}

/**
 * Weekly Digest Email Template
 */
export interface WeeklyDigestProps {
	userName?: string
	/** Array of notifications to include */
	notifications: Array<{
		type: string
		title: string
		body?: string
		contextUrl?: string
		actorName?: string
		createdAt: string
	}>
	/** Date range for the digest */
	startDate: Date
	endDate: Date
}

export function WeeklyDigestEmailTemplate({
	userName,
	notifications,
	startDate,
	endDate,
}: WeeklyDigestProps) {
	const subject = 'Your weekly digest from Constellate'
	const previewText = `Catch up on ${notifications.length} notifications from this week`

	const startDateStr = startDate.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
	const endDateStr = endDate.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})

	const groupedNotifications = notifications.reduce(
		(groups, notif) => {
			const type = notif.type.toUpperCase()
			if (!groups[type]) groups[type] = []
			groups[type].push(notif)
			return groups
		},
		{} as Record<string, typeof notifications>
	)

	const content = `
		 <p>Here's what happened on Constellate this week (${startDateStr} - ${endDateStr}):</p>
    
		 ${
				notifications.length === 0
					? '<p>You have 0 notifications this week. Check back next time!</p>'
					: Object.entries(groupedNotifications)
							.map(
								([type, notifs]) => `
				 <div style="margin: 24px 0;">
					 <h4 style="margin: 0 0 12px; color: #1e293b; font-size: 16px; font-weight: 600; text-transform: capitalize;">
						 ${getNotificationIcon(type)} ${type.toLowerCase()} (${notifs.length})
					 </h4>
					 ${notifs
							.map((notif) => {
								const safeTitle = DOMPurify.sanitize(notif.title)
								const safeBody = notif.body ? DOMPurify.sanitize(notif.body) : ''
								const safeContextUrl = notif.contextUrl
									? DOMPurify.sanitize(notif.contextUrl)
									: ''
								const safeActorName = notif.actorName
									? DOMPurify.sanitize(notif.actorName)
									: ''
								return `
						 <div style="background-color: #f8fafc; border-left: 3px solid ${getNotificationColor(type)}; padding: 12px 16px; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
							 <p style="margin: 0 0 4px; color: #1e293b; font-weight: 500;">${safeTitle}</p>
							 ${notif.body ? `<p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">${safeBody}</p>` : ''}
							 ${
									notif.contextUrl
										? `
								 <a href="${safeContextUrl}" style="color: ${getNotificationColor(type)}; text-decoration: none; font-size: 14px; font-weight: 500;">
									 View →
								 </a>
							 `
										: ''
								}
							 <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">
								 ${new Date(notif.createdAt).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric',
									})}
								 ${notif.actorName ? ` • ${safeActorName}` : ''}
							 </p>
						 </div>
					 `
							})
							.join('')}
				 </div>
			 `
							)
							.join('')
			}
    
		 <div style="text-align: center; margin: 32px 0;">
			 ${EmailButton({
					children: 'View All Notifications',
					href: '{{{NOTIFICATIONS_URL}}}',
					variant: 'primary',
					fullWidth: true,
				})}
		 </div>
    
		 <p style="color: #64748b; font-size: 14px; font-style: italic;">
			 Too many emails? <a href="{{{PREFERENCES_URL}}}" style="color: #3b82f6; text-decoration: underline;">Customize your notification settings</a>.
		 </p>
	 `

	return BaseEmailTemplate({
		subject,
		previewText,
		userName,
		children: content,
	})
}
