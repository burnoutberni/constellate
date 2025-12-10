import { Link } from 'react-router-dom'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'

export interface SignUpPromptProps {
  /**
   * The action the user wants to perform
   */
  action?: 'rsvp' | 'like' | 'comment' | 'share' | 'follow'
  /**
   * Custom message to display
   */
  message?: string
  /**
   * Callback when sign up button is clicked
   */
  onSignUp?: () => void
  /**
   * Variant of the prompt
   * - 'inline': Shows as a small inline prompt with a link
   * - 'card': Shows as a card with a button
   * @default 'inline'
   */
  variant?: 'inline' | 'card'
}

/**
 * SignUpPrompt component displays a call-to-action for unauthenticated users
 * to sign up for the platform.
 * 
 * Used throughout the app to encourage sign-ups for specific actions.
 */
export function SignUpPrompt({
  action,
  message,
  onSignUp,
  variant = 'inline',
}: SignUpPromptProps) {
  const getDefaultMessage = () => {
    if (message) return message

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

  if (variant === 'inline') {
    return (
      <p className="text-sm text-text-secondary text-center">
        💡{' '}
        {onSignUp ? (
          <button
            onClick={onSignUp}
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
        to {action ? getActionText(action) : 'continue'}
      </p>
    )
  }

  // Card variant
  return (
    <Card variant="flat" padding="md">
      <CardContent className="space-y-3">
        <p className="text-sm text-text-primary">{displayMessage}</p>
        {onSignUp ? (
          <Button variant="primary" fullWidth onClick={onSignUp}>
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

/**
 * Helper function to get the action text for inline variant
 */
function getActionText(action: string): string {
  switch (action) {
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
