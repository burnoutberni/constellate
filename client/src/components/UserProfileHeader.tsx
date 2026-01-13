import type { UserProfile } from '@/types'

import { FollowButton } from './FollowButton'
import { Stack } from './layout'
import { ReportButton } from './ReportButton'
import { Avatar, Badge, Card } from './ui'
import { SafeHTML } from './ui/SafeHTML'

interface UserProfileHeaderProps {
	user: UserProfile
	isOwnProfile: boolean
	followerCount: number
	followingCount: number
	eventCount: number
	onFollowersClick?: () => void
	onFollowingClick?: () => void
	showFollowButton: boolean
	headerImageUrl?: string | null
	isAuthenticated?: boolean
	isFollowing?: boolean
	isFollowPending?: boolean
	isFollowLoading?: boolean
	onFollowClick?: () => void
	onUnfollowClick?: () => void
}

/**
 * UserProfileHeader component displays user profile information including
 * avatar, name, bio, stats, and follow/unfollow actions.
 */
export function UserProfileHeader({
	user,
	isOwnProfile,
	followerCount,
	followingCount,
	eventCount,
	onFollowersClick,
	onFollowingClick,
	showFollowButton,
	headerImageUrl,
	isAuthenticated,
	isFollowing,
	isFollowPending,
	isFollowLoading,
	onFollowClick,
	onUnfollowClick,
}: UserProfileHeaderProps) {
	// Extract instance hostname from external actor URL
	const getInstanceHostname = () => {
		if (!user.isRemote || !user.externalActorUrl) {
			return null
		}
		try {
			return new URL(user.externalActorUrl).hostname
		} catch {
			return null
		}
	}

	const instanceHostname = getInstanceHostname()
	const isPrivate = user.isPublicProfile === false

	return (
		<>
			{/* Header Image - hide for private profiles if not owner */}
			{headerImageUrl && (!isPrivate || isOwnProfile) && (
				<div className="w-full h-48 rounded-lg overflow-hidden mb-4">
					<img
						src={headerImageUrl}
						alt="Profile header"
						className="w-full h-full object-cover"
					/>
				</div>
			)}

			{/* Profile Info Card */}
			<Card variant="default" padding="lg" className="mb-6">
				<Stack direction="column" directionSm="row" alignSm="start" gap="md">
					{/* Avatar */}
					<Avatar
						src={user.profileImage || undefined}
						fallback={(user.name || user.username).charAt(0).toUpperCase()}
						alt={user.name || user.username}
						size="xl"
						bordered
						className="flex-shrink-0"
					/>

					{/* User Info */}
					<div className="flex-1 min-w-0">
						<Stack
							direction="column"
							directionSm="row"
							alignSm="start"
							justifySm="between"
							gap="sm"
							className="mb-3">
							<div className="min-w-0 flex-1">
								<h1 className="text-2xl font-bold text-text-primary truncate">
									{user.name || user.username}
								</h1>
								<div className="flex items-center gap-2 flex-wrap">
									<p className="text-text-secondary text-sm">@{user.username}</p>
									{isPrivate && (
										<Badge variant="warning" size="sm">
											🔒 Private account
										</Badge>
									)}
									{user.isRemote && (
										<>
											<Badge variant="info" size="sm">
												Remote
											</Badge>
											{instanceHostname && (
												<a
													href={user.externalActorUrl || '#'}
													target="_blank"
													rel="noopener noreferrer"
													className="text-text-tertiary text-xs hover:underline hover:text-primary-600 transition-colors">
													from {instanceHostname}
												</a>
											)}
										</>
									)}
								</div>
							</div>

							<div className="flex flex-shrink-0 items-center gap-2">
								{/* Follow Button */}
								{!isOwnProfile && showFollowButton && (
									<FollowButton
										username={user.username}
										followStatus={
											typeof isFollowing === 'boolean'
												? { isFollowing, isAccepted: !isFollowPending }
												: undefined
										}
										isPending={isFollowPending}
										onClick={isFollowing ? onUnfollowClick : onFollowClick}
										isLoading={isFollowLoading}
									/>
								)}

								{/* Report Button */}
								{!isOwnProfile && isAuthenticated && (
									<ReportButton
										targetType="user"
										targetId={user.id}
										contentTitle={user.name || user.username}
										variant="ghost"
										size="md"
									/>
								)}
							</div>
						</Stack>

						{/* Bio - hide for private profiles if not owner */}
						{user.bio && (!isPrivate || isOwnProfile) && (
							<div className="text-text-primary mb-4">
								<SafeHTML html={user.bio} />
							</div>
						)}

						{/* Stats - hide counts for private profiles if not owner */}
						{(!isPrivate || isOwnProfile) && (
							<div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
								<span className="text-text-primary">
									<strong className="font-semibold">{eventCount}</strong>{' '}
									<span className="text-text-secondary">{eventCount === 1 ? 'Event' : 'Events'}</span>
								</span>
								<button
									type="button"
									onClick={onFollowersClick}
									className="bg-transparent border-0 p-0 cursor-pointer text-left text-sm text-text-primary hover:text-primary-600 transition-colors">
									<strong className="font-semibold">{followerCount}</strong>{' '}
									<span className="text-text-secondary">{followerCount === 1 ? 'Follower' : 'Followers'}</span>
								</button>
								<button
									type="button"
									onClick={onFollowingClick}
									className="bg-transparent border-0 p-0 cursor-pointer text-left text-sm text-text-primary hover:text-primary-600 transition-colors">
									<strong className="font-semibold">{followingCount}</strong>{' '}
									<span className="text-text-secondary">Following</span>
								</button>
							</div>
						)}


					</div>
				</Stack>
			</Card>
		</>
	)
}
