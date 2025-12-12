import { describe, it, expect, vi } from 'vitest'
import { type ReactElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NotificationItem } from '../../components/NotificationItem'
import type { Notification } from '../../types'

const mockNotification: Notification = {
	id: '1',
	type: 'COMMENT',
	title: 'New comment on your event',
	body: 'Someone commented on your event.',
	contextUrl: '/events/123',
	read: false,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	readAt: null,
	data: null,
	actor: {
		id: 'user-1',
		username: 'testuser',
		name: 'Test User',
		displayColor: '#3b82f6',
		profileImage: null,
	},
}

const renderWithRouter = (ui: ReactElement) => {
	return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('NotificationItem Component', () => {
	it('should render notification title and body', () => {
		renderWithRouter(<NotificationItem notification={mockNotification} />)

		expect(screen.getByText('New comment on your event')).toBeInTheDocument()
		expect(screen.getByText('Someone commented on your event.')).toBeInTheDocument()
	})

	it('should render actor information when provided', () => {
		renderWithRouter(<NotificationItem notification={mockNotification} />)

		expect(screen.getByText('Test User')).toBeInTheDocument()
		expect(screen.getByText('@testuser')).toBeInTheDocument()
	})

	it('should render mark as read button for unread notifications', () => {
		const onMarkRead = vi.fn()
		renderWithRouter(
			<NotificationItem notification={mockNotification} onMarkRead={onMarkRead} />
		)

		const markReadButton = screen.getByRole('button', {
			name: /mark.*as read/i,
		})
		expect(markReadButton).toBeInTheDocument()

		fireEvent.click(markReadButton)
		expect(onMarkRead).toHaveBeenCalledWith('1')
	})

	it('should not render mark as read button for read notifications', () => {
		const readNotification = { ...mockNotification, read: true }
		renderWithRouter(<NotificationItem notification={readNotification} />)

		const markReadButton = screen.queryByRole('button', {
			name: /mark.*as read/i,
		})
		expect(markReadButton).not.toBeInTheDocument()
	})

	it('should render view details button when contextUrl is provided', () => {
		renderWithRouter(<NotificationItem notification={mockNotification} />)

		const viewButton = screen.getByRole('button', { name: /view details/i })
		expect(viewButton).toBeInTheDocument()
	})

	it('should not render view details button when contextUrl is missing', () => {
		const notificationWithoutUrl = { ...mockNotification, contextUrl: null }
		renderWithRouter(<NotificationItem notification={notificationWithoutUrl} />)

		const viewButton = screen.queryByRole('button', { name: /view details/i })
		expect(viewButton).not.toBeInTheDocument()
	})

	it('should render in compact mode', () => {
		renderWithRouter(<NotificationItem notification={mockNotification} compact />)

		expect(screen.getByText('New comment on your event')).toBeInTheDocument()
		// In compact mode, it should be a button rather than a Card
		const compactButton = screen.getByRole('button', {
			name: /view notification/i,
		})
		expect(compactButton).toBeInTheDocument()
	})

	it('should render without body when not provided', () => {
		const notificationWithoutBody = { ...mockNotification, body: null }
		renderWithRouter(<NotificationItem notification={notificationWithoutBody} />)

		expect(screen.getByText('New comment on your event')).toBeInTheDocument()
		expect(screen.queryByText('Someone commented on your event.')).not.toBeInTheDocument()
	})

	it('should render unread badge for unread notifications', () => {
		renderWithRouter(<NotificationItem notification={mockNotification} />)

		expect(screen.getByText('Unread')).toBeInTheDocument()
	})

	it('should not render unread badge for read notifications', () => {
		const readNotification = { ...mockNotification, read: true }
		renderWithRouter(<NotificationItem notification={readNotification} />)

		expect(screen.queryByText('Unread')).not.toBeInTheDocument()
	})

	it('should handle notification without actor', () => {
		const notificationWithoutActor = { ...mockNotification, actor: null }
		renderWithRouter(<NotificationItem notification={notificationWithoutActor} />)

		expect(screen.getByText('New comment on your event')).toBeInTheDocument()
		expect(screen.queryByText('Test User')).not.toBeInTheDocument()
	})

	it('should call onMarkRead when clicking view details on unread notification', () => {
		const onMarkRead = vi.fn()
		renderWithRouter(
			<NotificationItem notification={mockNotification} onMarkRead={onMarkRead} />
		)

		const viewButton = screen.getByRole('button', { name: /view details/i })
		fireEvent.click(viewButton)

		expect(onMarkRead).toHaveBeenCalledWith('1')
	})
})
