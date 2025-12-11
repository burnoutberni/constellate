import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CommentThread } from '../../components/CommentThread'
import type { CommentWithMentions } from '../../types'

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: null,
        loading: false,
        login: vi.fn(),
        sendMagicLink: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
    }),
}))

const mockComment: CommentWithMentions = {
    id: '1',
    content: 'Test comment',
    createdAt: '2024-01-15T10:00:00Z',
    author: {
        id: 'user1',
        username: 'testuser',
        name: 'Test User',
        isRemote: false,
    },
    mentions: [],
    replies: [],
}

const mockCommentWithReplies: CommentWithMentions = {
    ...mockComment,
    replies: [
        {
            id: '2',
            content: 'Test reply',
            createdAt: '2024-01-15T11:00:00Z',
            author: {
                id: 'user2',
                username: 'replyuser',
                name: 'Reply User',
                isRemote: false,
            },
            mentions: [],
            replies: [],
        },
    ],
}

describe('CommentThread Component', () => {
    it('should render a comment', () => {
        render(
            <BrowserRouter>
                <CommentThread comment={mockComment} />
            </BrowserRouter>
        )

        expect(screen.getByText('Test comment')).toBeInTheDocument()
        expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('should render nested replies', () => {
        render(
            <BrowserRouter>
                <CommentThread comment={mockCommentWithReplies} />
            </BrowserRouter>
        )

        expect(screen.getByText('Test comment')).toBeInTheDocument()
        expect(screen.getByText('Test reply')).toBeInTheDocument()
        expect(screen.getByText('Reply User')).toBeInTheDocument()
    })

    it('should show reply button when onReply is provided and depth allows', () => {
        render(
            <BrowserRouter>
                <CommentThread
                    comment={mockComment}
                    onReply={vi.fn()}
                    depth={0}
                />
            </BrowserRouter>
        )

        expect(screen.getByRole('button', { name: /Reply/i })).toBeInTheDocument()
    })

    it('should not show reply button when depth is 2 or more', () => {
        render(
            <BrowserRouter>
                <CommentThread
                    comment={mockComment}
                    onReply={vi.fn()}
                    depth={2}
                />
            </BrowserRouter>
        )

        expect(screen.queryByRole('button', { name: /Reply/i })).not.toBeInTheDocument()
    })

    it('should show delete button for comment owner', () => {
        render(
            <BrowserRouter>
                <CommentThread
                    comment={mockComment}
                    currentUserId="user1"
                    onDelete={vi.fn()}
                />
            </BrowserRouter>
        )

        expect(screen.getByLabelText('Delete comment')).toBeInTheDocument()
    })

    it('should not show delete button for other users', () => {
        render(
            <BrowserRouter>
                <CommentThread
                    comment={mockComment}
                    currentUserId="user999"
                    onDelete={vi.fn()}
                />
            </BrowserRouter>
        )

        expect(screen.queryByLabelText('Delete comment')).not.toBeInTheDocument()
    })
})
