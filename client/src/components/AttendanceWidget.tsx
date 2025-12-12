import { Button } from './ui'
import { SignUpPrompt } from './SignUpPrompt'

interface AttendanceWidgetProps {
	/**
	 * Current user's attendance status
	 */
	userAttendance: string | null
	/**
	 * Number of users attending
	 */
	attendingCount: number
	/**
	 * Number of users with maybe status
	 */
	maybeCount: number
	/**
	 * Number of likes
	 */
	likeCount: number
	/**
	 * Whether the user has liked the event
	 */
	userLiked: boolean
	/**
	 * Whether the user has shared the event
	 */
	userHasShared: boolean
	/**
	 * Whether the user is authenticated
	 */
	isAuthenticated: boolean
	/**
	 * Whether RSVP mutation is pending
	 */
	isRSVPPending: boolean
	/**
	 * Whether like mutation is pending
	 */
	isLikePending: boolean
	/**
	 * Whether share mutation is pending
	 */
	isSharePending: boolean
	/**
	 * Callback when RSVP button is clicked
	 */
	onRSVP: (status: 'attending' | 'maybe') => void
	/**
	 * Callback when like button is clicked
	 */
	onLike: () => void
	/**
	 * Callback when share button is clicked
	 */
	onShare: () => void
	/**
	 * Callback when sign up is requested
	 */
	onSignUp?: () => void
}

/**
 * AttendanceWidget displays attendance status, RSVP buttons, and social actions
 * for an event. Handles authenticated and unauthenticated states.
 */
export function AttendanceWidget({
	userAttendance,
	attendingCount,
	maybeCount,
	likeCount,
	userLiked,
	userHasShared,
	isAuthenticated,
	isRSVPPending,
	isLikePending,
	isSharePending,
	onRSVP,
	onLike,
	onShare,
	onSignUp,
}: AttendanceWidgetProps) {
	const shouldShowRsvpSpinner = (status: 'attending' | 'maybe') => {
		if (!isRSVPPending) {
			return false
		}
		if (status === 'attending') {
			return userAttendance === 'attending' || !userAttendance
		}
		return userAttendance === 'maybe'
	}

	const getShareButtonText = () => {
		if (isSharePending) {
			return 'Sharing...'
		}
		if (userHasShared) {
			return '✅ Shared'
		}
		return '🔁 Share'
	}

	return (
		<div>
			{/* RSVP Buttons */}
			<div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-border-default">
				<Button
					variant={userAttendance === 'attending' ? 'primary' : 'secondary'}
					size="md"
					onClick={() => onRSVP('attending')}
					disabled={isRSVPPending}
					loading={shouldShowRsvpSpinner('attending')}
					className="flex-1 min-w-[120px]">
					{shouldShowRsvpSpinner('attending')
						? 'Updating...'
						: `👍 Going (${attendingCount})`}
				</Button>
				<Button
					variant={userAttendance === 'maybe' ? 'primary' : 'secondary'}
					size="md"
					onClick={() => onRSVP('maybe')}
					disabled={isRSVPPending}
					loading={shouldShowRsvpSpinner('maybe')}
					className="flex-1 min-w-[120px]">
					{shouldShowRsvpSpinner('maybe') ? 'Updating...' : `🤔 Maybe (${maybeCount})`}
				</Button>
				<Button
					variant={userLiked ? 'primary' : 'secondary'}
					size="md"
					onClick={onLike}
					disabled={isLikePending}
					loading={isLikePending}
					className="flex-1 min-w-[100px]">
					❤️ {likeCount}
				</Button>
				<Button
					variant={userHasShared ? 'primary' : 'secondary'}
					size="md"
					onClick={onShare}
					disabled={isSharePending || userHasShared}
					loading={isSharePending}
					className="flex-1 min-w-[100px]">
					{getShareButtonText()}
				</Button>
			</div>

			{/* Sign Up Prompt for unauthenticated users */}
			{!isAuthenticated && (
				<div className="mb-6 pb-4 border-b border-border-default">
					<SignUpPrompt variant="inline" onSignUp={onSignUp} />
				</div>
			)}
		</div>
	)
}
