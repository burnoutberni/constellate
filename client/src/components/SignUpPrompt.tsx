import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { SignupModal } from './SignupModal'

// Legacy API props - uses SignupModal
interface SignUpPromptPropsLegacy {
  /**
   * The action context for the prompt (e.g., "follow this user", "RSVP", etc.)
   */
  action?: string
  /**
   * Optional custom message
   */
  message?: string
  /**
   * Callback after successful signup/login
   */
  onSuccess?: () => void
  /**
   * Custom className for the card
   */
  className?: string
  variant?: never
  onSignUp?: never
}

// New API props - uses Link or onSignUp callback
interface SignUpPromptPropsNew {
  /**
   * The action the user wants to perform
   */
  action?: 'rsvp' | 'like' | 'comment' | 'share' | 'follow' | string
  /**
   * Custom message to display
   */
  message?: string
  /**
   * Callback when sign up button is clicked (alternative to opening modal)
   */
  onSignUp?: () => void
  /**
   * Variant of the prompt
   * - 'inline': Shows as a small inline prompt with a link
   * - 'card': Shows as a card with a button
   * @default 'inline'
   */
  variant?: 'inline' | 'card'
  /**
   * Additional CSS classes to apply to the component
   */
  className?: string
  onSuccess?: never
}

export type SignUpPromptProps = SignUpPromptPropsLegacy | SignUpPromptPropsNew

/**
 * SignUpPrompt component displays a call-to-action for unauthenticated users
 * to sign up or log in to perform specific actions.
 *
 * Used throughout the app to encourage sign-ups for specific actions.
 */
export function SignUpPrompt(props: SignUpPromptProps) {
  const [showSignupModal, setShowSignupModal] = useState(false)

  // Determine which API is being used
  const isLegacyAPI = 'onSuccess' in props || ('className' in props && !('variant' in props))
  const variant = isLegacyAPI ? undefined : (props.variant || 'inline')
  const action = props.action
  const message = props.message

  // Legacy API: uses SignupModal (always shows as card)
  if (isLegacyAPI) {
    const defaultMessage = `Sign up to ${action || 'continue'}`

    return (
      <>
        <Card variant="outlined" className={props.className}>
          <CardContent className="text-center py-6">
            <div className="text-4xl mb-3">👋</div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Join Constellate
            </h3>
            <p className="text-text-secondary mb-4">
              {message || defaultMessage}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowSignupModal(true)}
            >
              Sign Up
            </Button>
          </CardContent>
        </Card>

        <SignupModal
          isOpen={showSignupModal}
          onClose={() => setShowSignupModal(false)}
          onSuccess={() => {
            setShowSignupModal(false)
            props.onSuccess?.()
          }}
        />
      </>
    )
  }

  // New API: uses Link or onSignUp callback
<<<<<<< HEAD
  const getDefaultMessage = (): string => {
    if (message) return message

    if (typeof action === 'string' && !['rsvp', 'like', 'comment', 'share', 'follow'].includes(action)) {
      return `Sign up to ${action}`
    }

    switch (action) {
      case 'rsvp':
        return 'Sign up to RSVP to events'
      case 'like':
        return 'Sign up to like events'
      case 'comment':
        return 'Sign up to join the conversation and leave a comment'
      case 'share':
        return 'Sign up to share events with your followers'
      case 'follow':
        return 'Sign up to follow users and see their events'
      default:
        return 'Sign up to RSVP, like, and comment on events'
    }
  }

  const displayMessage = getDefaultMessage()

  /**
   * Helper function to get the action text for inline variant
   */
<<<<<<< HEAD
  const getActionText = (actionValue: string | undefined): string => {
    if (!actionValue) return 'continue'
    
    if (typeof actionValue === 'string' && !['rsvp', 'like', 'comment', 'share', 'follow'].includes(actionValue)) {
      return actionValue
    }

    switch (actionValue) {
      case 'rsvp':
        return 'RSVP to events'
      case 'like':
        return 'like events'
      case 'comment':
        return 'comment on events'
      case 'share':
        return 'share events'
      case 'follow':
        return 'follow users'
      default:
        return 'continue'
    }
  }

  if (variant === 'inline') {
    return (
      <p className={`text-sm text-text-secondary text-center ${props.className || ''}`}>
        💡{' '}
        {props.onSignUp ? (
          <button
            onClick={props.onSignUp}
            className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
          >
            Sign up
          </button>
        ) : (
          <Link
            to="/login"
            className="text-primary-600 hover:text-primary-700 hover:underline font-medium"
          >
            Sign up
          </Link>
        )}{' '}
        to {getActionText(action)}
      </p>
    )
  }

  // Card variant
  return (
    <Card variant="flat" padding="md" className={props.className}>
      <CardContent className="space-y-3">
        <p className="text-sm text-text-primary">{displayMessage}</p>
        {props.onSignUp ? (
          <Button variant="primary" fullWidth onClick={props.onSignUp}>
            Sign Up
          </Button>
        ) : (
          <Link to="/login" className="block">
            <Button variant="primary" fullWidth>
              Sign Up
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
