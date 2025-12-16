import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { User } from '@/types'

import { Modal, Button, Spinner, Avatar, Badge } from './ui'

interface FollowersModalProps {
	isOpen: boolean
	onClose: () => void
	username: string
	type: 'followers' | 'following'
}

export function FollowersModal({ isOpen, onClose, username, type }: FollowersModalProps) {
	const { data, isLoading } = useQuery<{ followers?: User[]; following?: User[] }>({
		queryKey:
			type === 'followers'
				? queryKeys.users.followers(username)
				: queryKeys.users.following(username),
		queryFn: async () => {
			return api.get<{ followers?: User[]; following?: User[] }>(
				`/user-search/profile/${encodeURIComponent(username)}/${type}`,
				undefined,
				undefined,
				'Failed to fetch'
			)
		},
		enabled: isOpen && Boolean(username),
	})

	const users = type === 'followers' ? data?.followers : data?.following

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			maxWidth="md"
			contentClassName="flex flex-col max-h-[80vh]">
			<div className="flex items-center justify-between p-6 pb-2">
				<h2 className="text-xl font-bold text-text-primary">
					{type === 'followers' ? 'Followers' : 'Following'}
				</h2>
				<Button
					onClick={onClose}
					variant="ghost"
					size="sm"
					className="text-text-secondary hover:text-text-primary text-2xl h-auto p-0 min-w-0">
					×
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6 pt-2">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size="md" />
					</div>
				) : (
					(() => {
						if (!users || users.length === 0) {
							return (
								<div className="text-center py-8 text-text-secondary">
									{type === 'followers'
										? 'No followers yet'
										: 'Not following anyone yet'}
								</div>
							)
						}
						return (
							<div className="space-y-2">
								{users.map((user) => (
									<Link
										key={user.id}
										to={`/@${user.username}`}
										onClick={onClose}
										className="flex items-center gap-3 p-3 rounded-lg hover:bg-background-secondary transition-colors group">
										<Avatar
											src={user.profileImage || undefined}
											alt={user.name || user.username}
											fallback={(user.name || user.username)
												.charAt(0)
												.toUpperCase()}
											size="md"
										/>
										<div className="flex-1 min-w-0">
											<div className="font-semibold text-text-primary group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
												{user.name || user.username}
											</div>
											<div className="text-sm text-text-secondary flex items-center gap-2">
												@{user.username}
												{user.isRemote && (
													<Badge variant="info" size="sm">
														Remote
													</Badge>
												)}
											</div>
										</div>
									</Link>
								))}
							</div>
						)
					})()
				)}
			</div>
		</Modal>
	)
}
