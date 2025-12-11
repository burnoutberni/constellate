import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CommentList } from '../../components/CommentList'
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

const mockComments: CommentWithMentions[] = [
    {
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
    },
]

describe('CommentList Component', () => {
    it('should render comment count', () => {
        render(
            <BrowserRouter>
                <CommentList
                    comments={mockComments}
                    currentUserId="user1"
                    isAuthenticated={true}
                    onAddComment={vi.fn()}
                />
            </BrowserRouter>
        )

        expect(screen.getByText(/Comments \(1\)/)).toBeInTheDocument()
    })

    it('should show empty state when no comments', () => {
        render(
            <BrowserRouter>
                <CommentList
                    comments={[]}
                    currentUserId="user1"
                    isAuthenticated={true}
                    onAddComment={vi.fn()}
                />
            </BrowserRouter>
        )

        expect(screen.getByText(/No comments yet/)).toBeInTheDocument()
    })

    it('should show sign up prompt when not authenticated', () => {
        render(
            <BrowserRouter>
                <CommentList
                    comments={[]}
                    currentUserId={undefined}
                    isAuthenticated={false}
                />
            </BrowserRouter>
        )

        expect(screen.getByText(/Sign up to join the conversation and leave a comment/)).toBeInTheDocument()
    })
})
