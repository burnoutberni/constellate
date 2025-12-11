import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { SignUpPrompt } from '../../components/SignUpPrompt'

// Mock useAuth hook for SignupModal
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    sendMagicLink: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock SignupModal component - path must match how SignUpPrompt imports it
// SignUpPrompt imports './SignupModal', so mock uses same path - Vitest resolves from source location
vi.mock('../../components/SignupModal', () => ({
  SignupModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="signup-modal">
        <form>
          <label>
            Username *
            <input type="text" name="username" />
          </label>
          <label>
            Email *
            <input type="email" name="email" />
          </label>
          <button type="submit">Create Account</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    ) : null,
}))

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('SignUpPrompt Component', () => {
  describe('Legacy API (with SignupModal)', () => {
    it('should render with default action text', () => {
      renderWithRouter(<SignUpPrompt className="test-class" />)

      expect(screen.getByText('Join Constellate')).toBeInTheDocument()
      expect(screen.getByText('Sign up to continue')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    })

    it('should render with custom action text', () => {
      renderWithRouter(<SignUpPrompt action="follow this user" className="test-class" />)

      expect(screen.getByText('Sign up to follow this user')).toBeInTheDocument()
    })

    it('should render with custom message', () => {
      const customMessage = 'Create an account to unlock all features'
      renderWithRouter(<SignUpPrompt message={customMessage} className="test-class" />)

      expect(screen.getByText(customMessage)).toBeInTheDocument()
    })

    it('should open signup modal when sign up button is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<SignUpPrompt className="test-class" />)

      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(signUpButton)

      // Modal should appear with signup form visible to user
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument()
        expect(screen.getByLabelText(/^Username/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument()
      })
    })

    it('should close signup modal when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<SignUpPrompt className="test-class" />)

      // Open modal
      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(signUpButton)

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument()
      })

      // Close modal using cancel button
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      // Modal should close - signup form should not be visible
      await waitFor(() => {
        expect(screen.queryByLabelText(/^Username/i)).not.toBeInTheDocument()
      })
    })

    it('should show signup form when button is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<SignUpPrompt onSuccess={vi.fn()} />)

      const signUpButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(signUpButton)

      // User can see the signup form
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument()
      })
    })

  })

  describe('New API - inline variant', () => {
    it('renders default inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" />)

      expect(screen.getByText(/Sign up/)).toBeInTheDocument()
      expect(screen.getByText(/to continue/)).toBeInTheDocument()
    })

    it('renders action-specific inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" action="rsvp" />)

      expect(screen.getByText(/to RSVP to events/)).toBeInTheDocument()
    })

    it('renders follow action inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" action="follow" />)

      expect(screen.getByText(/to follow users/)).toBeInTheDocument()
    })

    it('renders custom string action inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" action="follow this user" />)

      expect(screen.getByText(/to follow this user/)).toBeInTheDocument()
    })


    it('links to login page when onSignUp not provided', () => {
      renderWithRouter(<SignUpPrompt variant="inline" />)

      const link = screen.getByRole('link', { name: /sign up/i })
      expect(link).toHaveAttribute('href', '/login')
    })

    it('calls onSignUp when provided', async () => {
      const onSignUp = vi.fn()
      const user = userEvent.setup()
      renderWithRouter(<SignUpPrompt variant="inline" onSignUp={onSignUp} />)

      const button = screen.getByRole('button', { name: /sign up/i })
      await user.click(button)

      expect(onSignUp).toHaveBeenCalledOnce()
    })
  })

  describe('New API - card variant', () => {
    it('renders default card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" />)

      expect(
        screen.getByText(/Sign up to RSVP, like, and comment on events/)
      ).toBeInTheDocument()
    })

    it('renders action-specific card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" action="comment" />)

      expect(
        screen.getByText(/Sign up to join the conversation and leave a comment/)
      ).toBeInTheDocument()
    })

    it('renders follow action card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" action="follow" />)

      expect(
        screen.getByText(/Sign up to follow users and see their events/)
      ).toBeInTheDocument()
    })

    it('renders custom string action card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" action="follow this user" />)

      expect(screen.getByText(/Sign up to follow this user/)).toBeInTheDocument()
    })


    it('renders custom message', () => {
      renderWithRouter(<SignUpPrompt variant="card" message="Custom message" />)

      expect(screen.getByText('Custom message')).toBeInTheDocument()
    })

    it('renders sign up button', () => {
      renderWithRouter(<SignUpPrompt variant="card" />)

      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    })

    it('calls onSignUp when button is clicked', async () => {
      const onSignUp = vi.fn()
      const user = userEvent.setup()
      renderWithRouter(<SignUpPrompt variant="card" onSignUp={onSignUp} />)

      const button = screen.getByRole('button', { name: /sign up/i })
      await user.click(button)

      expect(onSignUp).toHaveBeenCalledOnce()
    })

    it('links to login page when onSignUp not provided', () => {
      renderWithRouter(<SignUpPrompt variant="card" />)

      const link = screen.getByRole('link', { name: /sign up/i })
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('New API - action types', () => {
    const actions: Array<'rsvp' | 'like' | 'comment' | 'share' | 'follow'> = [
      'rsvp',
      'like',
      'comment',
      'share',
      'follow',
    ]

    it.each(actions)('renders message for %s action', (action) => {
      renderWithRouter(<SignUpPrompt variant="card" action={action} />)

      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    })
  })
})
