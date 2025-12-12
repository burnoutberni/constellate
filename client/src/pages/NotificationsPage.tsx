import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Container, Stack } from '@/components/layout'
import { Button, Badge, Card, Spinner } from '@/components/ui'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationSettings } from '../components/NotificationSettings'
import { useAuth } from '../hooks/useAuth'
import {
	useNotifications,
	useMarkNotificationRead,
	useMarkAllNotificationsRead,
} from '@/hooks/queries'
import { useUIStore } from '@/stores'
import type { NotificationType } from '@/types'

export function NotificationsPage() {
	const { user, logout } = useAuth()
	const { sseConnected } = useUIStore()
	const navigate = useNavigate()

	const [filterType, setFilterType] = useState<NotificationType | 'ALL'>('ALL')
	const [showSettings, setShowSettings] = useState(false)

	const { data, isLoading, isFetching, error, isError } = useNotifications(50, {
		enabled: Boolean(user),
	})
	const { mutate: markNotificationRead } = useMarkNotificationRead()
	const { mutate: markAllNotificationsRead, isPending: markAllPending } =
		useMarkAllNotificationsRead()

	const unreadCount = data?.unreadCount ?? 0

	const sortedNotifications = useMemo(() => {
		const notifs = data?.notifications ?? []
		return [...notifs].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		)
	}, [data?.notifications])

	const filteredNotifications = useMemo(() => {
		if (filterType === 'ALL') {
			return sortedNotifications
		}
		return sortedNotifications.filter((n) => n.type === filterType)
	}, [sortedNotifications, filterType])

	const handleMarkNotificationRead = (notificationId: string) => {
		markNotificationRead(notificationId)
	}

	const filterOptions: Array<{ value: NotificationType | 'ALL'; label: string }> = [
		{ value: 'ALL', label: 'All' },
		{ value: 'FOLLOW', label: 'Followers' },
		{ value: 'COMMENT', label: 'Comments' },
		{ value: 'LIKE', label: 'Likes' },
		{ value: 'MENTION', label: 'Mentions' },
		{ value: 'EVENT', label: 'Events' },
		{ value: 'SYSTEM', label: 'System' },
	]

	const renderNotificationList = () => {
		if (isLoading) {
			return (
				<Card
					variant="elevated"
					padding="lg"
					className="flex items-center justify-center min-h-[200px]"
					role="status"
					aria-label="Loading notifications"
					aria-live="polite">
					<Spinner size="md" />
				</Card>
			)
		}

		if (isError) {
			return (
				<Card variant="elevated" padding="lg" className="text-center">
					<p className="text-lg font-semibold text-text-primary mb-2">
						Unable to load notifications
					</p>
					<p className="text-text-secondary mb-4">
						{error instanceof Error
							? error.message
							: 'An error occurred while fetching notifications.'}
					</p>
					<Button variant="primary" onClick={() => window.location.reload()}>
						Retry
					</Button>
				</Card>
			)
		}

		if (filteredNotifications.length === 0) {
			return (
				<Card variant="elevated" padding="lg" className="text-center">
					<p className="text-lg font-semibold text-text-primary mb-2">
						{filterType === 'ALL'
							? "You're all caught up!"
							: `No ${filterType.toLowerCase()} notifications`}
					</p>
					<p className="text-text-secondary">
						{filterType === 'ALL'
							? "We'll let you know as soon as something new happens."
							: 'Try selecting a different filter.'}
					</p>
				</Card>
			)
		}

		return filteredNotifications.map((notification) => (
			<NotificationItem
				key={notification.id}
				notification={notification}
				onMarkRead={handleMarkNotificationRead}
			/>
		))
	}

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={sseConnected} user={user} onLogout={logout} />

			<Container size="lg" className="py-10 space-y-6">
				<Stack
					direction="column"
					directionSm="row"
					alignSm="center"
					justifySm="between"
					gap="md">
					<div>
						<p className="text-sm uppercase tracking-wide text-text-tertiary">Inbox</p>
						<h1 className="text-3xl font-bold text-text-primary">Notifications</h1>
						<p className="text-sm text-text-secondary">
							Stay up to date with mentions, follows, comments, and event updates.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Badge variant={isFetching ? 'warning' : 'default'} size="md">
							{isFetching ? 'Refreshing…' : `${unreadCount} unread`}
						</Badge>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => markAllNotificationsRead()}
							disabled={unreadCount === 0 || markAllPending}>
							Mark all read
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowSettings(!showSettings)}>
							{showSettings ? 'Hide Settings' : 'Settings'}
						</Button>
					</div>
				</Stack>

				{!user && (
					<Card variant="elevated" padding="lg" className="text-center">
						<h2 className="text-xl font-semibold text-text-primary mb-2">
							Sign in to view notifications
						</h2>
						<p className="text-text-secondary mb-6">
							Create an account or log in to start receiving updates about your events
							and connections.
						</p>
						<Button variant="primary" onClick={() => navigate('/login')}>
							Sign In
						</Button>
					</Card>
				)}

				{user && showSettings && (
					<NotificationSettings
						preferences={{}}
						onUpdate={(_prefs) => {
							// Note: API endpoint for saving preferences not yet implemented in backend
						}}
					/>
				)}

				{user && (
					<>
						<Card
							variant="default"
							padding="md"
							className="flex flex-wrap items-center gap-2">
							<span className="text-sm font-medium text-text-secondary">
								Filter by:
							</span>
							{filterOptions.map((option) => (
								<Button
									key={option.value}
									variant={filterType === option.value ? 'primary' : 'ghost'}
									size="sm"
									onClick={() => setFilterType(option.value)}>
									{option.label}
								</Button>
							))}
						</Card>

						<div className="space-y-4">{renderNotificationList()}</div>
					</>
				)}
			</Container>
		</div>
	)
}
