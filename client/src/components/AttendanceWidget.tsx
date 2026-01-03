import { RSVPButton } from './RSVPButton'
import { SignUpPrompt } from './SignUpPrompt'
import { Button } from './ui'

interface AttendanceWidgetProps {
	eventId: string
	userAttendance: string | null
	attendingCount: number
	maybeCount: number
	likeCount: number
	userLiked: boolean
	userHasShared: boolean
	isAuthenticated: boolean
	isLikePending: boolean
	isSharePending: boolean
	onLike: () => void
	onShare: () => void
	onSignUp?: () => void
}

export function AttendanceWidget({
	eventId,
	userAttendance,
	attendingCount,
	maybeCount,
	likeCount,
	userLiked,
	userHasShared,
	isAuthenticated,
	isLikePending,
	isSharePending,
	onLike,
	onShare,
	onSignUp,
}: AttendanceWidgetProps) {
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
			{/* RSVP Buttons & Actions */}
			<div className="flex flex-wrap items-start gap-4 mb-4 pb-4 border-b border-border-default">
				<div className="flex flex-col gap-1">
					<RSVPButton
						eventId={eventId}
						currentStatus={
							userAttendance &&
								['attending', 'maybe', 'not_attending'].includes(userAttendance)
								? (userAttendance as 'attending' | 'maybe' | 'not_attending')
								: null
						}
						size="md"
						className="min-w-[140px]"
					/>
					<div className="text-xs text-text-secondary px-1">
						{attendingCount} going • {maybeCount} maybe
					</div>
				</div>

				<Button
					variant={userLiked ? 'primary' : 'secondary'}
					size="md"
					onClick={onLike}
					disabled={isLikePending}
					loading={isLikePending}
					className="min-w-[100px]">
					❤️ {likeCount}
				</Button>

				<Button
					variant={userHasShared ? 'primary' : 'secondary'}
					size="md"
					onClick={onShare}
					disabled={isSharePending || userHasShared}
					loading={isSharePending}
					className="min-w-[100px]">
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
