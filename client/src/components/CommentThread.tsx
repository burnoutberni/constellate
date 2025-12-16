import { useState } from 'react'

import { createLogger } from '@/lib/logger'
import type { CommentWithMentions } from '@/types'

import { CommentForm } from './CommentForm'
import { CommentItem } from './CommentItem'
import { Stack } from './layout'

const log = createLogger('[CommentThread]')

interface CommentThreadProps {
	comment: CommentWithMentions
	currentUserId?: string
	onDelete?: (commentId: string) => void
	onReply?: (parentId: string, content: string) => Promise<void>
	isDeleting?: boolean
	depth?: number
}

export function CommentThread({
	comment,
	currentUserId,
	onDelete,
	onReply,
	isDeleting = false,
	depth = 0,
}: CommentThreadProps) {
	const [showReplyForm, setShowReplyForm] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleReplyClick = () => {
		setShowReplyForm(true)
	}

	const handleReplySubmit = async (content: string) => {
		if (!onReply) {
			return
		}

		setIsSubmitting(true)
		try {
			await onReply(comment.id, content)
			setShowReplyForm(false)
		} catch (error) {
			log.error('Failed to submit reply:', error)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleCancelReply = () => {
		setShowReplyForm(false)
	}

	return (
		<Stack direction="column" gap="sm">
			<CommentItem
				comment={comment}
				currentUserId={currentUserId}
				onDelete={onDelete}
				onReply={onReply ? handleReplyClick : undefined}
				isDeleting={isDeleting}
				depth={depth}
			/>

			{showReplyForm && (
				<div className="ml-11">
					<CommentForm
						onSubmit={handleReplySubmit}
						placeholder="Write a reply..."
						submitLabel="Reply"
						onCancel={handleCancelReply}
						isSubmitting={isSubmitting}
						autoFocus
					/>
				</div>
			)}

			{comment.replies && comment.replies.length > 0 && (
				<Stack
					direction="column"
					gap="sm"
					className="ml-11 border-l-2 border-border-default pl-4">
					{comment.replies.map((reply) => (
						<CommentThread
							key={reply.id}
							comment={reply}
							currentUserId={currentUserId}
							onDelete={onDelete}
							onReply={onReply}
							isDeleting={isDeleting}
							depth={depth + 1}
						/>
					))}
				</Stack>
			)}
		</Stack>
	)
}
