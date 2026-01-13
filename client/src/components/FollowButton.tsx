import { useState } from 'react'

import { useFollowUser, useUnfollowUser, useFollowStatus } from '@/hooks/queries'

import { useAuth } from '../hooks/useAuth'

import { Button } from './ui'

interface FollowButtonProps {
	username: string
	variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
	size?: 'sm' | 'md' | 'lg'
	fullWidth?: boolean
	followStatus?: { isFollowing: boolean; isAccepted: boolean } | null
}

const FollowIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true">
		<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<line x1="19" y1="8" x2="19" y2="14" />
		<line x1="22" y1="11" x2="16" y2="11" />
	</svg>
)

const FollowingIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true">
		<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
		<path d="M16 3.13a4 4 0 0 1 0 7.75" />
	</svg>
)

const PendingIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true">
		<circle cx="12" cy="12" r="10" />
		<polyline points="12 6 12 12 16 14" />
	</svg>
)

type ButtonState = 'idle' | 'loading' | 'success'

export function FollowButton({
	username,
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	followStatus: providedStatus,
}: FollowButtonProps) {
	const { user } = useAuth()
	const { data: fetchedStatus, isLoading: statusLoading } = useFollowStatus(username)
	const followMutation = useFollowUser(username)
	const unfollowMutation = useUnfollowUser(username)

	const [buttonState, setButtonState] = useState<ButtonState>('idle')

	if (!user || user.username === username) {
		return null
	}

	const followStatus = providedStatus ?? fetchedStatus
	const isFollowing = followStatus?.isFollowing ?? false
	const isAccepted = followStatus?.isAccepted ?? false
	const isPending = isFollowing && !isAccepted

	const isLoading = statusLoading || followMutation.isPending || unfollowMutation.isPending

		const handleClick = async () => {
		if (isLoading) {return}

		setButtonState('loading')

		const currentUserData = {
			id: user.id,
			username: user.username ?? undefined,
			name: user.name ?? undefined,
			profileImage: user.image ?? undefined,
			isRemote: user.isRemote,
		}

		try {
			if (isPending) {
				await unfollowMutation.mutateAsync({ currentUser: currentUserData })
			} else if (isFollowing) {
				await unfollowMutation.mutateAsync({ currentUser: currentUserData })
			} else {
				await followMutation.mutateAsync({ currentUser: currentUserData })
			}
			setButtonState('success')
			setTimeout(() => setButtonState('idle'), 1500)
		} catch {
			setButtonState('idle')
		}
	}

	if (statusLoading && providedStatus === undefined) {
		return (
			<Button variant={variant} size={size} fullWidth={fullWidth} disabled loading>
				Loading...
			</Button>
		)
	}

	const getButtonContent = () => {
		if (isPending) {
			return {
				icon: <PendingIcon className="w-4 h-4" />,
				text: 'Pending',
				ariaLabel: 'Follow request pending - tap to cancel',
			}
		}
		if (isFollowing) {
			return {
				icon: <FollowingIcon className="w-4 h-4" />,
				text: 'Following',
				ariaLabel: 'You are following - tap to unfollow',
			}
		}
		return {
			icon: <FollowIcon className="w-4 h-4" />,
			text: 'Follow',
			ariaLabel: `Follow ${username}`,
		}
	}

	const { icon, text, ariaLabel } = getButtonContent()

	const buttonVariant = isPending ? 'outline' : isFollowing ? 'secondary' : variant

	return (
		<Button
			variant={buttonVariant}
			size={size}
			fullWidth={fullWidth}
			onClick={handleClick}
			loading={isLoading}
			aria-label={ariaLabel}
			aria-busy={buttonState === 'loading'}
			aria-pressed={isFollowing && !isPending}>
			<span className="flex items-center gap-2">
				<span className="flex-shrink-0">{icon}</span>
				<span>{text}</span>
			</span>
		</Button>
	)
}
