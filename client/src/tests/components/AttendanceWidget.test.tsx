import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttendanceWidget } from '../../components/AttendanceWidget'
import { createTestWrapper } from '../testUtils'

// Mock SignUpPrompt component - it uses Link which needs Router context
vi.mock('../../components/SignUpPrompt', () => ({
    SignUpPrompt: ({ variant, onSignUp }: { variant?: string; onSignUp?: () => void }) => (
        <div data-testid="sign-up-prompt" data-variant={variant}>
            <button onClick={onSignUp}>Sign Up</button>
        </div>
    ),
}))

const { wrapper } = createTestWrapper()

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
        render(<AttendanceWidget {...defaultProps} />, { wrapper })

        expect(screen.getByText(/👍 Going \(10\)/)).toBeInTheDocument()
        expect(screen.getByText(/🤔 Maybe \(5\)/)).toBeInTheDocument()
        expect(screen.getByText(/❤️ 15/)).toBeInTheDocument()
    })


    it('shows shared state when user has shared', () => {
        render(<AttendanceWidget {...defaultProps} userHasShared={true} />, { wrapper })

        expect(screen.getByText(/✅ Shared/)).toBeInTheDocument()
    })

    it('calls onRSVP with attending status', () => {
        const onRSVP = vi.fn()
        render(<AttendanceWidget {...defaultProps} onRSVP={onRSVP} />, { wrapper })

        const goingButton = screen.getByText(/👍 Going/).closest('button')
        expect(goingButton).toBeTruthy()
        if (goingButton) {
            fireEvent.click(goingButton)
        }

        expect(onRSVP).toHaveBeenCalledWith('attending')
    })

    it('calls onRSVP with maybe status', () => {
        const onRSVP = vi.fn()
        render(<AttendanceWidget {...defaultProps} onRSVP={onRSVP} />, { wrapper })

        const maybeButton = screen.getByText(/🤔 Maybe/).closest('button')
        expect(maybeButton).toBeTruthy()
        if (maybeButton) {
            fireEvent.click(maybeButton)
        }

        expect(onRSVP).toHaveBeenCalledWith('maybe')
    })

    it('calls onLike when like button is clicked', () => {
        const onLike = vi.fn()
        render(<AttendanceWidget {...defaultProps} onLike={onLike} />, { wrapper })

        const likeButton = screen.getByText(/❤️/).closest('button')
        expect(likeButton).toBeTruthy()
        if (likeButton) {
            fireEvent.click(likeButton)
        }

        expect(onLike).toHaveBeenCalled()
    })

    it('calls onShare when share button is clicked', () => {
        const onShare = vi.fn()
        render(<AttendanceWidget {...defaultProps} onShare={onShare} />, { wrapper })

        const shareButton = screen.getByText(/🔁 Share/).closest('button')
        expect(shareButton).toBeTruthy()
        if (shareButton) {
            fireEvent.click(shareButton)
        }

        expect(onShare).toHaveBeenCalled()
    })

    it('disables RSVP buttons when pending', () => {
        render(<AttendanceWidget {...defaultProps} isRSVPPending={true} />, { wrapper })

        const goingButton = screen.getByText(/Updating.../).closest('button')
        const maybeButton = screen.getByText(/🤔 Maybe/).closest('button')

        expect(goingButton).toBeDisabled()
        expect(maybeButton).toBeDisabled()
    })

    it('disables share button when user has shared', () => {
        render(<AttendanceWidget {...defaultProps} userHasShared={true} />, { wrapper })

        const shareButton = screen.getByText(/✅ Shared/).closest('button')
        expect(shareButton).toBeDisabled()
    })

    it('shows sign up prompt for unauthenticated users', () => {
        render(<AttendanceWidget {...defaultProps} isAuthenticated={false} />, { wrapper })

        expect(screen.getByTestId('sign-up-prompt')).toBeInTheDocument()
        expect(screen.getByTestId('sign-up-prompt')).toHaveAttribute('data-variant', 'inline')
    })

    it('does not show sign up prompt for authenticated users', () => {
        render(<AttendanceWidget {...defaultProps} isAuthenticated={true} />, { wrapper })

        expect(screen.queryByTestId('sign-up-prompt')).not.toBeInTheDocument()
    })

    it('shows updating text when RSVP is pending for attending', () => {
        render(<AttendanceWidget {...defaultProps} isRSVPPending={true} userAttendance="attending" />, { wrapper })

        expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    it('shows sharing text when share is pending', () => {
        render(<AttendanceWidget {...defaultProps} isSharePending={true} />, { wrapper })

        expect(screen.getByText('Sharing...')).toBeInTheDocument()
    })
})
