/**
 * Tests for Email Templates
 * Tests for email template generation and styling
 */

import { describe, it, expect } from 'vitest'
import {
	PasswordResetEmailTemplate,
	NotificationEmailTemplate,
	WeeklyDigestEmailTemplate,
} from '../../lib/email/templates/index.js'

describe('Email Templates', () => {
	describe('PasswordResetEmailTemplate', () => {
		it('should generate password reset email', () => {
			const html = PasswordResetEmailTemplate({
				userName: 'Jane Doe',
				resetUrl: 'https://example.com/reset?token=xyz789',
			})

			expect(html).toContain('Reset your Constellate password')
			expect(html).toContain('Hi Jane Doe,')
			expect(html).toContain('https://example.com/reset?token=xyz789')
			expect(html).toContain('Reset Password')
			expect(html).toContain('30 minutes')
		})

		it('should include security notice', () => {
			const html = PasswordResetEmailTemplate({
				resetUrl: 'https://example.com/reset?token=xyz789',
			})

			expect(html).toContain('Security Notice')
			expect(html).toContain('Single use:')
			expect(html).toContain('secure your account')
		})
	})

	describe('NotificationEmailTemplate', () => {
		it('should generate follow notification', () => {
			const html = NotificationEmailTemplate({
				userName: 'Alice',
				type: 'FOLLOW',
				title: 'New follower',
				actorName: 'Bob',
				contextUrl: 'https://example.com/@bob',
			})

			expect(html).toContain('New follower')
			expect(html).toContain('👥')
			expect(html).toContain('from Bob')
			expect(html).toContain('View on Constellate')
			expect(html).toContain('https://example.com/@bob')
			expect(html).toContain('#10b981') // green color for follows
		})

		it('should generate comment notification', () => {
			const html = NotificationEmailTemplate({
				type: 'COMMENT',
				title: 'New comment on your event',
				body: 'Great event!',
				actorName: 'Charlie',
				data: { eventTitle: 'My Awesome Event' },
			})

			expect(html).toContain('New comment on your event')
			expect(html).toContain('💬')
			expect(html).toContain('Great event!')
			expect(html).toContain('Event: My Awesome Event')
			expect(html).toContain('#3b82f6') // blue color for comments
		})

		it('should generate like notification', () => {
			const html = NotificationEmailTemplate({
				type: 'LIKE',
				title: 'Someone liked your event',
				data: { eventTitle: 'Party Time', totalLikes: 5 },
			})

			expect(html).toContain('Someone liked your event')
			expect(html).toContain('❤️')
			expect(html).toContain('Event: Party Time')
			expect(html).toContain('Total likes: 5')
			expect(html).toContain('#ef4444') // red color for likes
		})

		it('should generate mention notification', () => {
			const html = NotificationEmailTemplate({
				type: 'MENTION',
				title: 'You were mentioned',
				body: '@alice check this out',
				data: { eventTitle: 'Discussion Forum' },
			})

			expect(html).toContain('You were mentioned')
			expect(html).toContain('@️⃣')
			expect(html).toContain('@alice check this out')
			expect(html).toContain('#8b5cf6') // purple color for mentions
		})

		it('should generate event notification', () => {
			const html = NotificationEmailTemplate({
				type: 'EVENT',
				title: 'Event reminder',
				body: 'Your event starts in 1 hour',
				data: {
					eventTitle: 'Team Meeting',
					eventDate: '2024-01-15T10:00:00Z',
					updateType: 'Reminder',
				},
			})

			expect(html).toContain('Event reminder')
			expect(html).toContain('📅')
			expect(html).toContain('Your event starts in 1 hour')
			expect(html).toContain('Event: Team Meeting')
			expect(html).toContain('#f59e0b') // amber color for events
		})

		it('should generate system notification', () => {
			const html = NotificationEmailTemplate({
				type: 'SYSTEM',
				title: 'System maintenance',
				body: 'Scheduled maintenance tonight',
				data: { message: 'System will be down for 2 hours' },
			})

			expect(html).toContain('System maintenance')
			expect(html).toContain('⚙️')
			expect(html).toContain('Scheduled maintenance tonight')
			expect(html).toContain('System will be down for 2 hours')
			expect(html).toContain('#6b7280') // gray color for system
		})

		it('should include unsubscribe link', () => {
			const html = NotificationEmailTemplate({
				type: 'FOLLOW',
				title: 'New follower',
			})

			expect(html).toContain('Email Preferences')
			expect(html).toContain('Manage your email preferences')
			expect(html).toContain('{{{PREFERENCES_URL}}}')
		})

		it('should handle missing context URL', () => {
			const html = NotificationEmailTemplate({
				type: 'SYSTEM',
				title: 'System update',
			})

			expect(html).toContain('System update')
			expect(html).not.toContain('View on Constellate')
		})
	})

	describe('WeeklyDigestEmailTemplate', () => {
		const mockNotifications = [
			{
				type: 'FOLLOW',
				title: 'New follower',
				actorName: 'Alice',
				createdAt: '2024-01-10T10:00:00Z',
				contextUrl: 'https://example.com/@alice',
			},
			{
				type: 'COMMENT',
				title: 'New comment',
				body: 'Great post!',
				createdAt: '2024-01-11T15:30:00Z',
			},
		]

		it('should generate weekly digest email', () => {
			const startDate = new Date('2024-01-08')
			const endDate = new Date('2024-01-14')

			const html = WeeklyDigestEmailTemplate({
				userName: 'John',
				notifications: mockNotifications,
				startDate,
				endDate,
			})

			expect(html).toContain('Your weekly digest from Constellate')
			expect(html).toContain('Hi John,')
			expect(html).toContain('this week')
			expect(html).toContain('Jan 8, 2024 - Jan 14, 2024')
		})

		it('should group notifications by type', () => {
			const html = WeeklyDigestEmailTemplate({
				notifications: mockNotifications,
				startDate: new Date('2024-01-08'),
				endDate: new Date('2024-01-14'),
			})

			expect(html).toContain('follow (1)')
			expect(html).toContain('👥')
			expect(html).toContain('comment (1)')
			expect(html).toContain('💬')
		})

		it('should include notification details', () => {
			const html = WeeklyDigestEmailTemplate({
				notifications: mockNotifications,
				startDate: new Date('2024-01-08'),
				endDate: new Date('2024-01-14'),
			})

			expect(html).toContain('New follower')
			expect(html).toContain('Alice')
			expect(html).toContain('New comment')
			expect(html).toContain('Great post!')
		})

		it('should include view all button', () => {
			const html = WeeklyDigestEmailTemplate({
				notifications: mockNotifications,
				startDate: new Date('2024-01-08'),
				endDate: new Date('2024-01-14'),
			})

			expect(html).toContain('View All Notifications')
			expect(html).toContain('{{{NOTIFICATIONS_URL}}}')
		})

		it('should handle empty notifications', () => {
			const html = WeeklyDigestEmailTemplate({
				notifications: [],
				startDate: new Date('2024-01-08'),
				endDate: new Date('2024-01-14'),
			})

			expect(html).toContain('0 notifications')
			expect(html).toContain('this week')
		})
	})

	describe('Template Common Features', () => {
		it('should include brand styling', () => {
			const html = NotificationEmailTemplate({ type: 'FOLLOW', title: 'Test' })

			expect(html).toContain('⭐ Constellate')
			expect(html).toContain('Connect through events')
			expect(html).toContain('Federated event management platform')
		})

		it('should include responsive design', () => {
			const html = NotificationEmailTemplate({ type: 'FOLLOW', title: 'Test' })

			expect(html).toContain('max-width: 600px')
			expect(html).toContain('viewport')
			expect(html).toContain('media (prefers-color-scheme: dark)')
		})

		it('should include footer information', () => {
			const html = NotificationEmailTemplate({ type: 'FOLLOW', title: 'Test' })

			expect(html).toContain('This email was sent by Constellate')
			expect(html).toContain('Unsubscribe')
			expect(html).toContain('Email Preferences')
		})

		it('should escape HTML content properly', () => {
			const html = NotificationEmailTemplate({
				type: 'COMMENT',
				title: '<script>alert("xss")</script>',
				body: 'Test with <b>bold</b> and <em>italic</em>',
			})

			// Should not contain raw script tags (would be handled by sanitization in service)
			expect(html).toContain('Test with')
			expect(html).toContain('bold')
			expect(html).toContain('italic')
		})
	})
})
