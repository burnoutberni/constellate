import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { User } from '@/types'

import { useAuth } from '../hooks/useAuth'

import { FollowButton } from './FollowButton'
import { Modal, Button, Spinner, Avatar, Badge } from './ui'

interface UserListItemProps {
	user: User & { isPending?: boolean; isFollowing?: boolean }
	onClose: () => void
	currentUserId?: string
}

export function UserListItem({ user, onClose, currentUserId }: Readonly<UserListItemProps>) {
	const isSelf = user.id === currentUserId

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
			{isSelf && !user.isFollowing && (
				<span className="text-xs text-text-tertiary flex-shrink-0">You</span>
			)}
		</div>
	)
}

interface UserListSectionProps {
	title: string
	count: number
	users: (User & { isPending?: boolean; isFollowing?: boolean })[]
	onClose: () => void
	currentUserId?: string
}

export function UserListSection({ title, count, users, onClose, currentUserId }: Readonly<UserListSectionProps>) {
	if (users.length === 0) {
		return null
	}

	return (
		<div className="mb-4">
			<h3 className="text-sm font-medium text-text-secondary px-3 mb-2 flex items-center gap-1">
				<span>{title}</span>
				<span className="text-text-tertiary font-normal">({count})</span>
			</h3>
			<div className="space-y-1">{users.map((user) => (
				<UserListItem
					key={user.id}
					user={user}
					onClose={onClose}
					currentUserId={currentUserId}
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

	const users = (type === 'followers' ? data?.followers : data?.following) || []

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
	const userTypeLabel = type === 'followers' ? 'Followers' : 'Following'
	const remoteUserTypeLabel = type === 'followers' ? 'Remote Followers' : 'Remote Following'

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
							title="Local Users"
							count={sortedLocalUsers.length}
							users={sortedLocalUsers}
							onClose={onClose}
							currentUserId={currentUser?.id}
						/>
						<div className="border-t border-border-default my-4" />
						<UserListSection
							title="Remote Users"
							count={sortedRemoteUsers.length}
							users={sortedRemoteUsers}
							onClose={onClose}
							currentUserId={currentUser?.id}
						/>
					</div>
				)}
				{localUsers.length > 0 && remoteUsers.length === 0 && (
					<UserListSection
						title={userTypeLabel}
						count={sortedLocalUsers.length}
						users={sortedLocalUsers}
						onClose={onClose}
						currentUserId={currentUser?.id}
					/>
				)}
				{remoteUsers.length > 0 && localUsers.length === 0 && (
					<UserListSection
						title={remoteUserTypeLabel}
						count={sortedRemoteUsers.length}
						users={sortedRemoteUsers}
						onClose={onClose}
						currentUserId={currentUser?.id}
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
