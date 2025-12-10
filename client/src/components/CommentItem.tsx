import { Link } from 'react-router-dom'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import type { CommentWithMentions } from '../types'

const mentionSplitRegex = /(@[\w.-]+(?:@[\w.-]+)?)/g

interface CommentItemProps {
    comment: CommentWithMentions
    currentUserId?: string
    onDelete?: (commentId: string) => void
    onReply?: (commentId: string) => void
    isDeleting?: boolean
    depth?: number
}

export function CommentItem({
    comment,
    currentUserId,
    onDelete,
    onReply,
    isDeleting = false,
    depth = 0,
}: CommentItemProps) {
    const isOwner = currentUserId === comment.author.id
    const canReply = depth < 2 // Only allow replies up to 2 levels deep

    const renderCommentContent = (text: string, mentions?: typeof comment.mentions) => {
        if (!mentions || mentions.length === 0) {
            return text
        }

        const mentionMap = new Map<string, (typeof mentions)[0]>()
        mentions.forEach((mention) => {
            const normalizedHandle = mention.handle?.startsWith('@')
                ? mention.handle.slice(1).toLowerCase()
                : mention.handle.toLowerCase()
            mentionMap.set(normalizedHandle, mention)
            mentionMap.set(mention.user.username.toLowerCase(), mention)
        })

        return text.split(mentionSplitRegex).map((part, index) => {
            if (!part) {
                return null
            }

            if (part.startsWith('@')) {
                const normalized = part.slice(1).toLowerCase()
                const mention = mentionMap.get(normalized)

                if (mention) {
                    return (
                        <Link
                            key={`${comment.id}-mention-${index}`}
                            to={`/@${mention.user.username}`}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            {part}
                        </Link>
                    )
                }
            }

            return <span key={`${comment.id}-text-${index}`}>{part}</span>
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
                <div className="bg-background-secondary rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1 gap-2">
                        <Link
                            to={`/@${comment.author.username}`}
                            className="font-semibold text-sm text-text-primary hover:underline truncate"
                        >
                            {comment.author.name || comment.author.username}
                        </Link>
                        {isOwner && onDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(comment.id)}
                                disabled={isDeleting}
                                className="text-error-500 hover:text-error-700 text-xs flex-shrink-0"
                                aria-label="Delete comment"
                            >
                                🗑️
                            </Button>
                        )}
                    </div>
                    <p className="text-text-primary break-words">
                        {renderCommentContent(comment.content, comment.mentions)}
                    </p>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    {canReply && onReply && (
                        <button
                            onClick={() => onReply(comment.id)}
                            className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                            Reply
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
