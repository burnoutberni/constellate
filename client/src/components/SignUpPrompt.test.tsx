import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { SignUpPrompt } from './SignUpPrompt'

describe('SignUpPrompt', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>)
  }

  describe('inline variant', () => {
    it('renders default inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" />)

      expect(screen.getByText(/Sign up/)).toBeInTheDocument()
      expect(screen.getByText(/to continue/)).toBeInTheDocument()
    })

    it('renders action-specific inline message', () => {
      renderWithRouter(<SignUpPrompt variant="inline" action="rsvp" />)

      expect(screen.getByText(/to RSVP to events/)).toBeInTheDocument()
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

  describe('card variant', () => {
    it('renders default card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" />)

      expect(screen.getByText(/Sign up to RSVP, like, and comment on events/)).toBeInTheDocument()
    })

    it('renders action-specific card message', () => {
      renderWithRouter(<SignUpPrompt variant="card" action="comment" />)

      expect(screen.getByText(/Sign up to join the conversation and leave a comment/)).toBeInTheDocument()
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
  })

  describe('action types', () => {
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
