import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttendanceWidget } from './AttendanceWidget'

// Mock SignUpPrompt component
vi.mock('./SignUpPrompt', () => ({
    SignUpPrompt: ({ variant, onSignUp }: { variant?: string; onSignUp?: () => void }) => (
        <div data-testid="sign-up-prompt" data-variant={variant}>
            <button onClick={onSignUp}>Sign Up</button>
        </div>
    ),
}))

describe('AttendanceWidget', () => {
    const defaultProps = {
        userAttendance: null,
        attendingCount: 10,
        maybeCount: 5,
        likeCount: 15,
        userLiked: false,
        userHasShared: false,
        isAuthenticated: true,
        isRSVPPending: false,
        isLikePending: false,
        isSharePending: false,
        onRSVP: vi.fn(),
        onLike: vi.fn(),
        onShare: vi.fn(),
    }

    it('renders RSVP buttons with correct counts', () => {
        render(<AttendanceWidget {...defaultProps} />)

        expect(screen.getByText(/👍 Going \(10\)/)).toBeInTheDocument()
        expect(screen.getByText(/🤔 Maybe \(5\)/)).toBeInTheDocument()
        expect(screen.getByText(/❤️ 15/)).toBeInTheDocument()
    })

    it('highlights attending button when user is attending', () => {
        render(<AttendanceWidget {...defaultProps} userAttendance="attending" />)

        const goingButton = screen.getByText(/👍 Going/).closest('button')
        expect(goingButton).toHaveClass('bg-primary-600')
    })

    it('highlights maybe button when user status is maybe', () => {
        render(<AttendanceWidget {...defaultProps} userAttendance="maybe" />)

        const maybeButton = screen.getByText(/🤔 Maybe/).closest('button')
        expect(maybeButton).toHaveClass('bg-primary-600')
    })

    it('highlights like button when user has liked', () => {
        render(<AttendanceWidget {...defaultProps} userLiked={true} />)

        const likeButton = screen.getByText(/❤️/).closest('button')
        expect(likeButton).toHaveClass('bg-primary-600')
    })

    it('shows shared state when user has shared', () => {
        render(<AttendanceWidget {...defaultProps} userHasShared={true} />)

        expect(screen.getByText(/✅ Shared/)).toBeInTheDocument()
    })

    it('calls onRSVP with attending status', () => {
        const onRSVP = vi.fn()
        render(<AttendanceWidget {...defaultProps} onRSVP={onRSVP} />)

        const goingButton = screen.getByText(/👍 Going/).closest('button')
        fireEvent.click(goingButton!)

        expect(onRSVP).toHaveBeenCalledWith('attending')
    })

    it('calls onRSVP with maybe status', () => {
        const onRSVP = vi.fn()
        render(<AttendanceWidget {...defaultProps} onRSVP={onRSVP} />)

        const maybeButton = screen.getByText(/🤔 Maybe/).closest('button')
        fireEvent.click(maybeButton!)

        expect(onRSVP).toHaveBeenCalledWith('maybe')
    })

    it('calls onLike when like button is clicked', () => {
        const onLike = vi.fn()
        render(<AttendanceWidget {...defaultProps} onLike={onLike} />)

        const likeButton = screen.getByText(/❤️/).closest('button')
        fireEvent.click(likeButton!)

        expect(onLike).toHaveBeenCalled()
    })

    it('calls onShare when share button is clicked', () => {
        const onShare = vi.fn()
        render(<AttendanceWidget {...defaultProps} onShare={onShare} />)

        const shareButton = screen.getByText(/🔁 Share/).closest('button')
        fireEvent.click(shareButton!)

        expect(onShare).toHaveBeenCalled()
    })

    it('disables RSVP buttons when pending', () => {
        render(<AttendanceWidget {...defaultProps} isRSVPPending={true} />)

        const goingButton = screen.getByText(/Updating.../).closest('button')
        const maybeButton = screen.getByText(/🤔 Maybe/).closest('button')

        expect(goingButton).toBeDisabled()
        expect(maybeButton).toBeDisabled()
    })

    it('disables share button when user has shared', () => {
        render(<AttendanceWidget {...defaultProps} userHasShared={true} />)

        const shareButton = screen.getByText(/✅ Shared/).closest('button')
        expect(shareButton).toBeDisabled()
    })

    it('shows sign up prompt for unauthenticated users', () => {
        render(<AttendanceWidget {...defaultProps} isAuthenticated={false} />)

        expect(screen.getByTestId('sign-up-prompt')).toBeInTheDocument()
        expect(screen.getByTestId('sign-up-prompt')).toHaveAttribute('data-variant', 'inline')
    })

    it('does not show sign up prompt for authenticated users', () => {
        render(<AttendanceWidget {...defaultProps} isAuthenticated={true} />)

        expect(screen.queryByTestId('sign-up-prompt')).not.toBeInTheDocument()
    })

    it('shows updating text when RSVP is pending for attending', () => {
        render(<AttendanceWidget {...defaultProps} isRSVPPending={true} userAttendance="attending" />)

        expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    it('shows sharing text when share is pending', () => {
        render(<AttendanceWidget {...defaultProps} isSharePending={true} />)

        expect(screen.getByText('Sharing...')).toBeInTheDocument()
    })
})
