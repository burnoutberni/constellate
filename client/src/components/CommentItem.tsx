import { Link } from 'react-router-dom'

import type { CommentWithMentions } from '@/types'

import { ReportButton } from './ReportButton'
import { Avatar, Button } from './ui'

const mentionSplitRegex = /(@[\w.-]+(?:@[\w.-]+)?)/g

interface CommentItemProps {
	comment: CommentWithMentions
	currentUserId?: string
	onDelete?: (commentId: string) => void
	onReply?: (commentId: string) => void
	isDeleting?: boolean
	depth?: number
	isAuthenticated?: boolean
}

export function CommentItem({
	comment,
	currentUserId,
	onDelete,
	onReply,
	isDeleting = false,
	depth = 0,
	isAuthenticated,
}: CommentItemProps) {
	const isOwner = currentUserId === comment.author.id
	const canReply = depth < 2 // Only allow replies up to 2 levels deep

	const renderCommentContent = (text: string, mentions?: typeof comment.mentions) => {
		if (!mentions || mentions.length === 0) {
			return text
		}

		const mentionMap = new Map<string, (typeof mentions)[0]>()
		mentions.forEach((mention) => {
			const normalizedHandle = mention.handle.startsWith('@')
				? mention.handle.slice(1).toLowerCase()
				: mention.handle.toLowerCase()
			mentionMap.set(normalizedHandle, mention)
			mentionMap.set(mention.user.username.toLowerCase(), mention)
		})

		let charOffset = 0
		return text.split(mentionSplitRegex).map((part) => {
			if (!part) {
				return null
			}

			const startOffset = charOffset
			charOffset += part.length
			const partKey = `${comment.id}-${startOffset}-${part.slice(0, 20)}`

			if (part.startsWith('@')) {
				const normalized = part.slice(1).toLowerCase()
				const mention = mentionMap.get(normalized)

				if (mention) {
					return (
						<Link
							key={`mention-${partKey}`}
							to={`/@${mention.user.username}`}
							className="text-info-600 font-medium hover:underline">
							{part}
						</Link>
					)
				}
			}

			return <span key={`text-${partKey}`}>{part}</span>
		})
	}

	return (
		<div className="flex gap-3">
			<Avatar
				src={comment.author.profileImage || undefined}
				alt={comment.author.name || comment.author.username}
				fallback={comment.author.name?.[0] || comment.author.username[0]}
				size="sm"
				className="flex-shrink-0"
			/>
			<div className="flex-1 min-w-0">
				<div className="bg-background-secondary rounded-lg p-3 group relative">
					<div className="flex items-center justify-between mb-1 gap-2">
						<Link
							to={`/@${comment.author.username}`}
							className="font-semibold text-sm text-text-primary hover:underline truncate">
							{comment.author.name || comment.author.username}
						</Link>
						<div className="flex items-center gap-2">
							{isAuthenticated && !isOwner && (
								<div className="opacity-0 group-hover:opacity-100 transition-opacity">
									<ReportButton
										targetType="comment"
										targetId={comment.id}
										contentTitle={`Comment by ${comment.author.username}`}
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
									/>
								</div>
							)}
							{isOwner && onDelete && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onDelete(comment.id)}
									disabled={isDeleting}
									className="text-error-500 hover:text-error-700 text-xs flex-shrink-0 h-6 w-6 p-0"
									aria-label="Delete comment">
									🗑️
								</Button>
							)}
						</div>
					</div>
					<p className="text-text-primary break-words">
						{renderCommentContent(comment.content, comment.mentions)}
					</p>
				</div>
				<div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
					<span>{new Date(comment.createdAt).toLocaleString()}</span>
					{canReply && onReply && (
						<Button
							onClick={() => onReply(comment.id)}
							variant="ghost"
							size="sm"
							className="text-primary-600 hover:text-primary-700 font-medium text-xs h-auto p-0">
							Reply
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
