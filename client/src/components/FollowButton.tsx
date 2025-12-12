import { useFollowUser, useUnfollowUser, useFollowStatus } from '@/hooks/queries'

import { useAuth } from '../hooks/useAuth'

import { Button } from './ui'


interface FollowButtonProps {
	username: string
	variant?: 'primary' | 'secondary' | 'ghost'
	size?: 'sm' | 'md' | 'lg'
	showStatus?: boolean
}

/**
 * FollowButton component for following/unfollowing users.
 * Integrates with the follow API and shows loading states.
 */
export function FollowButton({
	username,
	variant = 'primary',
	size = 'sm',
	showStatus = false,
}: FollowButtonProps) {
	const { user } = useAuth()
	const { data: followStatus, isLoading: statusLoading } = useFollowStatus(username)
	const followMutation = useFollowUser(username)
	const unfollowMutation = useUnfollowUser(username)

	// Don't show button if user is not authenticated or if it's their own profile
	if (!user || user.username === username) {
		return null
	}

	const isFollowing = followStatus?.isFollowing ?? false
	const isAccepted = followStatus?.isAccepted ?? false
	const isPending = isFollowing && !isAccepted
	const isLoading = statusLoading || followMutation.isPending || unfollowMutation.isPending

	const handleClick = () => {
		// user is always defined here due to early return above

		if (isFollowing) {
			unfollowMutation.mutate()
		} else {
			followMutation.mutate()
		}
	}

	// Show loading state while checking status
	if (statusLoading) {
		return (
			<Button variant={variant} size={size} disabled loading>
				Loading...
			</Button>
		)
	}

	const getButtonText = () => {
		if (isFollowing) {
			return 'Unfollow'
		}
		if (isPending) {
			return 'Pending'
		}
		return 'Follow'
	}

	return (
		<>
			<Button
				variant={isFollowing ? 'secondary' : variant}
				size={size}
				onClick={handleClick}
				loading={isLoading}
				disabled={isLoading}>
				{getButtonText()}
			</Button>
			{showStatus && isPending && (
				<span className="text-xs text-text-tertiary ml-2">Follow request pending</span>
			)}
		</>
	)
}
