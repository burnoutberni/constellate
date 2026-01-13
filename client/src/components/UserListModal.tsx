import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { Link } from 'react-router-dom'

import { queryKeys, useUnfollowUser } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { User } from '@/types'

import { useAuth } from '../hooks/useAuth'

import { FollowButton } from './FollowButton'
import { Modal, Button, Spinner, Avatar, Badge } from './ui'

const CloseIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true">
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	</svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true">
		<polyline points="20 6 9 17 4 12" />
	</svg>
)

interface UserListItemProps {
	user: User & { isPending?: boolean; isFollowing?: boolean }
	onClose: () => void
	currentUserId?: string
	targetUsername?: string
}

export function UserListItem({ user, onClose, currentUserId, targetUsername }: Readonly<UserListItemProps>) {
	const isSelf = user.id === currentUserId
	let unfollowTarget: string
	if (user.isPending && targetUsername && isSelf) {
		unfollowTarget = targetUsername
	} else {
		unfollowTarget = user.unfollowTarget || user.username
	}
	const unfollowMutation = useUnfollowUser(unfollowTarget)

	const handleActionClick = async () => {
		if (unfollowMutation.isPending) {
			return
		}
		try {
			await unfollowMutation.mutateAsync()
		} catch (error) {
			console.error('Failed to cancel/unfollow:', error)
		}
	}

	let followStatus: { isFollowing: boolean; isAccepted: boolean } | null | undefined
	if (user.isFollowing) {
		followStatus = { isFollowing: true, isAccepted: !user.isPending }
	} else if (user.isPending) {
		followStatus = { isFollowing: true, isAccepted: false }
	} else {
		followStatus = null
	}

	return (
		<div className="flex items-center gap-3 p-3 rounded-lg hover:bg-background-secondary transition-colors group">
			<Link to={`/@${user.username}`} onClick={onClose} className="flex-shrink-0">
				<Avatar
					src={user.profileImage || undefined}
					alt={user.name || user.username}
					fallback={(user.name || user.username).charAt(0).toUpperCase()}
					size="md"
				/>
			</Link>
			<div className="flex-1 min-w-0">
				<Link
					to={`/@${user.username}`}
					onClick={onClose}
					className="block min-w-0">
					<div className="font-semibold text-text-primary group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
						{user.name || user.username}
					</div>
					<div className="text-sm text-text-secondary flex items-center gap-2 flex-wrap">
						<span className="truncate max-w-[180px] sm:max-w-[200px]">@{user.username}</span>
						{user.isPending && (
							<Badge variant="warning" size="sm">
								Pending
							</Badge>
						)}
						{user.isRemote && (
							<Badge variant="info" size="sm">
								Remote
							</Badge>
						)}
					</div>
				</Link>
			</div>
			{!isSelf && (
				<div className="flex-shrink-0">
					<FollowButton
						username={user.username}
						size="sm"
						followStatus={followStatus}
					/>
				</div>
			)}
			{user.isFollowing && (
				<div className="flex-shrink-0">
					<Button
						variant={user.isPending ? 'outline' : 'secondary'}
						size="sm"
						onClick={handleActionClick}
						loading={unfollowMutation.isPending}
						leftIcon={user.isPending ? <CloseIcon className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
						className="whitespace-nowrap">
						{user.isPending ? 'Cancel' : 'Unfollow'}
					</Button>
				</div>
			)}
			{isSelf && !user.isFollowing && (
				<span className="text-xs text-text-tertiary flex-shrink-0">You</span>
			)}
		</div>
	)
}

interface UserListSectionProps {
	title: string
	users: (User & { isPending?: boolean; isFollowing?: boolean })[]
	onClose: () => void
	currentUserId?: string
	targetUsername?: string
}

export function UserListSection({ title, users, onClose, currentUserId, targetUsername }: Readonly<UserListSectionProps>) {
	if (users.length === 0) {
		return null
	}

	let baseTitle = title
	let count: string | null = null
	const lastParenIndex = title.lastIndexOf(' (')
	if (lastParenIndex !== -1 && title.endsWith(')')) {
		const potentialCount = title.slice(lastParenIndex + 2, -1)
		if (/^\d+$/.test(potentialCount)) {
			baseTitle = title.slice(0, lastParenIndex)
			count = potentialCount
		}
	}

	return (
		<div className="mb-4">
			<h3 className="text-sm font-medium text-text-secondary px-3 mb-2 flex items-center gap-1">
				<span>{baseTitle}</span>
				{count && <span className="text-text-tertiary font-normal">({count})</span>}
			</h3>
			<div className="space-y-1">{users.map((user) => (
				<UserListItem
					key={user.id}
					user={user}
					onClose={onClose}
					currentUserId={currentUserId}
					targetUsername={targetUsername}
				/>
			))}</div>
		</div>
	)
}

interface UserListModalProps {
	isOpen: boolean
	onClose: () => void
	title: string
	username: string
	type: 'followers' | 'following'
}

function UserListModal({ isOpen, onClose, title, username, type }: Readonly<UserListModalProps>) {
	const { data, isLoading } = useQuery({
		queryKey:
			type === 'followers'
				? queryKeys.users.followers(username)
				: queryKeys.users.following(username),
		queryFn: async () => {
			return api.get<{
				followers?: User[]
				following?: User[]
				isRemote?: boolean
				remoteNote?: string | null
			}>(
				`/user-search/profile/${encodeURIComponent(username)}/${type}`,
				undefined,
				undefined,
				'Failed to fetch'
			)
		},
		enabled: isOpen && Boolean(username),
	})

	const { user: currentUser } = useAuth()

	const users = type === 'followers' ? data?.followers : data?.following

	if (!users) {
		return (
			<Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
				<div className="flex items-center justify-between p-6 pb-2">
					<h2 className="text-xl font-bold text-text-primary">{title}</h2>
					<Button
						onClick={onClose}
						variant="ghost"
						size="sm"
						className="text-text-secondary hover:text-text-primary text-2xl h-8 w-8 p-0 flex items-center justify-center -mr-2">
						×
					</Button>
				</div>
				<div className="flex-1 overflow-y-auto p-6 pt-2">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Spinner size="md" />
						</div>
					)}
				</div>
			</Modal>
		)
	}

	const localUsers: (User & { isPending?: boolean; isFollowing?: boolean })[] = []
	const remoteUsers: (User & { isPending?: boolean; isFollowing?: boolean })[] = []

	for (const user of users) {
		if (user.isRemote) {
			remoteUsers.push(user)
		} else {
			localUsers.push(user)
		}
	}

	const sortedLocalUsers = [...localUsers].sort((a, b) => {
		const aFollowing = a.isFollowing ? 1 : 0
		const bFollowing = b.isFollowing ? 1 : 0
		return bFollowing - aFollowing
	})

	const sortedRemoteUsers = [...remoteUsers].sort((a, b) => {
		const aFollowing = a.isFollowing ? 1 : 0
		const bFollowing = b.isFollowing ? 1 : 0
		return bFollowing - aFollowing
	})

	const emptyStateMessage = type === 'followers' ? 'No followers yet' : 'Not following anyone yet'

	let modalContent: React.ReactNode
	if (isLoading) {
		modalContent = (
			<div className="flex items-center justify-center py-8">
				<Spinner size="md" />
			</div>
		)
	} else if (users.length === 0) {
		modalContent = (
			<div className="text-center py-8 text-text-secondary">
				{emptyStateMessage}
			</div>
		)
	} else {
		modalContent = (
			<>
				{localUsers.length > 0 && remoteUsers.length > 0 && (
					<div className="mb-4">
						<UserListSection
							title={`Local Users (${sortedLocalUsers.length})`}
							users={sortedLocalUsers}
							onClose={onClose}
							currentUserId={currentUser?.id}
							targetUsername={username}
						/>
						<div className="border-t border-border-default my-4" />
						<UserListSection
							title={`Remote Users (${sortedRemoteUsers.length})`}
							users={sortedRemoteUsers}
							onClose={onClose}
							currentUserId={currentUser?.id}
							targetUsername={username}
						/>
					</div>
				)}
				{localUsers.length > 0 && remoteUsers.length === 0 && (
					<UserListSection
						title={`Followers (${sortedLocalUsers.length})`}
						users={sortedLocalUsers}
						onClose={onClose}
						currentUserId={currentUser?.id}
						targetUsername={username}
					/>
				)}
				{remoteUsers.length > 0 && localUsers.length === 0 && (
					<UserListSection
						title={`Remote Followers (${sortedRemoteUsers.length})`}
						users={sortedRemoteUsers}
						onClose={onClose}
						currentUserId={currentUser?.id}
						targetUsername={username}
					/>
				)}
			</>
		)
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
			<div className="bg-background-primary rounded-xl shadow-xl max-h-[80vh] flex flex-col">
				<div className="flex items-center justify-between p-6 pb-2 flex-shrink-0">
					<h2 className="text-xl font-bold text-text-primary">{title}</h2>
					<Button
						onClick={onClose}
						variant="ghost"
						size="sm"
						className="text-text-secondary hover:text-text-primary text-2xl h-8 w-8 p-0 flex items-center justify-center -mr-2">
						×
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto p-6 pt-2">
					{modalContent}
				</div>
			</div>
		</Modal>
	)
}

interface FollowersModalProps {
	isOpen: boolean
	onClose: () => void
	username: string
	type?: 'followers' | 'following'
}

export function FollowersModal({ isOpen, onClose, username, type = 'followers' }: Readonly<FollowersModalProps>) {
	return (
		<UserListModal
			isOpen={isOpen}
			onClose={onClose}
			title={type === 'followers' ? 'Followers' : 'Following'}
			username={username}
			type={type}
		/>
	)
}
