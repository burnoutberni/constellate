import type { CommentWithMentions } from '@/types'

import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'
import { Stack } from './layout'
import { SignUpPrompt } from './SignUpPrompt'

interface CommentListProps {
	comments: CommentWithMentions[]
	currentUserId?: string
	isAuthenticated: boolean
	onAddComment?: (content: string) => Promise<void>
	onReply?: (parentId: string, content: string) => Promise<void>
	onDelete?: (commentId: string) => void
	isAddingComment?: boolean
	isDeletingComment?: boolean
	onSignUpPrompt?: () => void
}

export function CommentList({
	comments,
	currentUserId,
	isAuthenticated,
	onAddComment,
	onReply,
	onDelete,
	isAddingComment = false,
	isDeletingComment = false,
	onSignUpPrompt,
}: CommentListProps) {
	return (
		<Stack direction="column" gap="lg">
			<h2 className="text-xl font-bold text-text-primary">Comments ({comments.length})</h2>

			{/* Comment Form */}
			{!isAuthenticated ? (
				<div className="mb-6">
					<SignUpPrompt action="comment" variant="card" onSignUp={onSignUpPrompt} />
				</div>
			) : (
				onAddComment && (
					<div className="mb-6">
						<CommentForm onSubmit={onAddComment} isSubmitting={isAddingComment} />
					</div>
				)
			)}

			{/* Comments Display */}
			{comments.length === 0 ? (
				<p className="text-text-secondary text-center py-8">
					No comments yet. Be the first to comment!
				</p>
			) : (
				<Stack direction="column" gap="md">
					{comments.map((comment) => (
						<CommentThread
							key={comment.id}
							comment={comment}
							currentUserId={currentUserId}
							onDelete={onDelete}
							onReply={onReply}
							isDeleting={isDeletingComment}
							depth={0}
						/>
					))}
				</Stack>
			)}
		</Stack>
	)
}
