import { CommentThread } from './CommentThread'
import { CommentForm } from './CommentForm'
import { SignUpPrompt } from './SignUpPrompt'
import type { CommentWithMentions } from '@/types'

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
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-text-primary">
                Comments ({comments.length})
            </h2>

            {/* Comment Form */}
            {!isAuthenticated ? (
                <div className="mb-6">
                    <SignUpPrompt
                        action="comment"
                        variant="card"
                        onSignUp={onSignUpPrompt}
                    />
                </div>
            ) : (
                onAddComment && (
                    <div className="mb-6">
                        <CommentForm
                            onSubmit={onAddComment}
                            isSubmitting={isAddingComment}
                        />
                    </div>
                )
            )}

            {/* Comments Display */}
            {comments.length === 0 ? (
                <p className="text-text-secondary text-center py-8">
                    No comments yet. Be the first to comment!
                </p>
            ) : (
                <div className="space-y-4">
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
                </div>
            )}
        </div>
    )
}
