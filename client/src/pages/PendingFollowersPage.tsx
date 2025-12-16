import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Button, Spinner } from '@/components/ui'
import { useThemeColors } from '@/design-system'
import { queryKeys } from '@/hooks/queries'
import { api } from '@/lib/api-client'
import type { User } from '@/types'

import { Navbar } from '../components/Navbar'
import { useAuth } from '../hooks/useAuth'

interface PendingFollower extends User {
	followerId: string
	createdAt: string
}

export function PendingFollowersPage() {
	const colors = useThemeColors()
	const { user, logout } = useAuth()
	const queryClient = useQueryClient()

	const { data, isLoading, error } = useQuery<{ followers: PendingFollower[] }>({
		queryKey: queryKeys.followers.pending(),
		queryFn: () =>
			api.get<{ followers: PendingFollower[] }>(
				'/followers/pending',
				undefined,
				undefined,
				'Failed to fetch pending followers'
			),
	})

	const acceptMutation = useMutation({
		mutationFn: (followerId: string) =>
			api.post(
				`/followers/${followerId}/accept`,
				undefined,
				undefined,
				'Failed to accept follower'
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.followers.pending() })
			queryClient.invalidateQueries({
				queryKey: queryKeys.users.profile(user?.username || ''),
			})
		},
	})

	const rejectMutation = useMutation({
		mutationFn: (followerId: string) =>
			api.post(
				`/followers/${followerId}/reject`,
				undefined,
				undefined,
				'Failed to reject follower'
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.followers.pending() })
		},
	})

	const formatDate = (dateString: string) =>
		new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})

	return (
		<div className="min-h-screen bg-background-secondary">
			<Navbar isConnected={false} user={user} onLogout={logout} />
			<div className="max-w-4xl mx-auto px-4 py-8">
				<h1 className="text-3xl font-bold text-text-primary mb-8">
					Pending Follow Requests
				</h1>

				{isLoading && (
					<div className="flex justify-center items-center py-12">
						<Spinner size="lg" />
					</div>
				)}

				{error && (
					<div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4 text-error-700 dark:text-error-400">
						{error instanceof Error
							? error.message
							: 'Failed to load pending followers'}
					</div>
				)}

				{data &&
					(data.followers.length === 0 ? (
						<div className="bg-background-primary rounded-lg shadow-sm p-8 text-center text-text-secondary">
							No pending follow requests
						</div>
					) : (
						<div className="space-y-4">
							{data.followers.map((follower) => (
								<div
									key={follower.followerId}
									className="bg-background-primary rounded-lg shadow-sm p-6">
									<div className="flex items-start gap-4">
										{follower.profileImage ? (
											<img
												src={follower.profileImage}
												alt={follower.name || follower.username}
												className="w-16 h-16 rounded-full object-cover"
											/>
										) : (
											<div
												className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold"
												style={{
													backgroundColor:
														follower.displayColor || colors.info[500],
												}}>
												{(follower.name || follower.username)
													.charAt(0)
													.toUpperCase()}
											</div>
										)}

										<div className="flex-1">
											<div className="flex items-start justify-between">
												<div>
													<Link
														to={`/@${follower.username}`}
														className="text-lg font-semibold text-text-primary hover:text-primary-600 dark:hover:text-primary-400">
														{follower.name || follower.username}
													</Link>
													<p className="text-sm text-text-secondary">
														@{follower.username}
														{follower.isRemote && (
															<span className="ml-2 text-xs bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300 px-2 py-1 rounded">
																Remote
															</span>
														)}
													</p>
													{follower.bio && (
														<p className="text-sm text-text-secondary mt-2">
															{follower.bio}
														</p>
													)}
													<p className="text-xs text-text-tertiary mt-2">
														Requested {formatDate(follower.createdAt)}
													</p>
												</div>
											</div>

											<div className="flex gap-3 mt-4">
												<Button
													onClick={() =>
														acceptMutation.mutate(follower.followerId)
													}
													disabled={
														acceptMutation.isPending ||
														rejectMutation.isPending
													}
													loading={acceptMutation.isPending}
													variant="primary">
													Accept
												</Button>
												<Button
													onClick={() =>
														rejectMutation.mutate(follower.followerId)
													}
													disabled={
														acceptMutation.isPending ||
														rejectMutation.isPending
													}
													loading={rejectMutation.isPending}
													variant="secondary">
													Reject
												</Button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					))}
			</div>
		</div>
	)
}
