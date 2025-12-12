import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'


import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { InstanceWithStats, UserProfile } from '@/types'

import { useAuth } from '../hooks/useAuth'

import { Card, Badge, Button, Avatar } from './ui'

interface InstanceCardProps {
	instance: InstanceWithStats
	onBlock?: (domain: string) => void
	onUnblock?: (domain: string) => void
	onRefresh?: (domain: string) => void
}

export function InstanceCard({ instance, onBlock, onUnblock, onRefresh }: InstanceCardProps) {
	const navigate = useNavigate()
	const { user } = useAuth()

	// Fetch user profile to check admin status
	const { data: userProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			try {
				return await api.get<UserProfile>(
					'/users/me/profile',
					undefined,
					undefined,
					'Failed to fetch profile'
				)
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
	})

	const isAdmin = userProfile?.isAdmin || false

	const formatDate = (dateString?: string) => {
		if (!dateString) {
			return 'Never'
		}
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	const formatRelativeTime = (dateString?: string) => {
		if (!dateString) {
			return 'Never'
		}
		const date = new Date(dateString)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) {
			return 'Today'
		}
		if (diffDays === 1) {
			return 'Yesterday'
		}
		if (diffDays < 7) {
			return `${diffDays} days ago`
		}
		if (diffDays < 30) {
			return `${Math.floor(diffDays / 7)} weeks ago`
		}
		if (diffDays < 365) {
			return `${Math.floor(diffDays / 30)} months ago`
		}
		return `${Math.floor(diffDays / 365)} years ago`
	}

	return (
		<Card className="p-6 hover:shadow-lg transition-shadow">
			<div className="flex items-start gap-4">
				{/* Instance Icon */}
				<Avatar
					src={instance.iconUrl}
					alt={instance.title || instance.domain}
					size="lg"
					fallback={instance.domain.substring(0, 2).toUpperCase()}
				/>

				{/* Instance Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1 min-w-0">
							<h3
								className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate cursor-pointer hover:text-info-600 dark:hover:text-info-400"
								onClick={() =>
									navigate(`/instances/${encodeURIComponent(instance.domain)}`)
								}>
								{instance.title || instance.domain}
							</h3>
							<p className="text-sm text-neutral-600 dark:text-neutral-400">
								{instance.domain}
							</p>
						</div>
						{instance.isBlocked && <Badge variant="error">Blocked</Badge>}
					</div>

					{instance.description && (
						<p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">
							{instance.description}
						</p>
					)}

					{/* Software Info */}
					<div className="mt-3 flex flex-wrap gap-2">
						{instance.software && (
							<Badge variant="secondary">
								{instance.software}
								{instance.version && ` ${instance.version}`}
							</Badge>
						)}
					</div>

					{/* Stats */}
					<div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
						<div>
							<div className="font-semibold text-neutral-900 dark:text-neutral-100">
								{instance.userCount?.toLocaleString() ?? 'N/A'}
							</div>
							<div className="text-neutral-600 dark:text-neutral-400">Users</div>
						</div>
						<div>
							<div className="font-semibold text-neutral-900 dark:text-neutral-100">
								{instance.eventCount?.toLocaleString() ?? 'N/A'}
							</div>
							<div className="text-neutral-600 dark:text-neutral-400">Events</div>
						</div>
						<div>
							<div className="font-semibold text-neutral-900 dark:text-neutral-100">
								{instance.stats.remoteUsers}
							</div>
							<div className="text-neutral-600 dark:text-neutral-400">
								Remote Users
							</div>
						</div>
						<div>
							<div className="font-semibold text-neutral-900 dark:text-neutral-100">
								{instance.stats.localFollowing}
							</div>
							<div className="text-neutral-600 dark:text-neutral-400">Following</div>
						</div>
					</div>

					{/* Activity Info */}
					<div className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
						Last activity: {formatRelativeTime(instance.lastActivityAt)}
						{instance.lastFetchedAt && (
							<> • Last fetched: {formatDate(instance.lastFetchedAt)}</>
						)}
					</div>

					{/* Error Info */}
					{instance.lastError && (
						<div className="mt-2 p-2 bg-error-50 dark:bg-error-900/20 rounded text-xs text-error-600 dark:text-error-400">
							{instance.lastError}
						</div>
					)}

					{/* Admin Actions */}
					{isAdmin && (
						<div className="mt-4 flex gap-2">
							{instance.isBlocked ? (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => onUnblock?.(instance.domain)}>
									Unblock
								</Button>
							) : (
								<Button
									size="sm"
									variant="danger"
									onClick={() => onBlock?.(instance.domain)}>
									Block
								</Button>
							)}
							<Button
								size="sm"
								variant="secondary"
								onClick={() => onRefresh?.(instance.domain)}>
								Refresh
							</Button>
						</div>
					)}
				</div>
			</div>
		</Card>
	)
}
