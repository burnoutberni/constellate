import { Link } from 'react-router-dom'

import { Button, Card, CardContent } from './ui'

interface SignUpPromptProps {
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
}

/**
 * SignUpPrompt component displays a call-to-action for unauthenticated users
 * to sign up or log in to perform specific actions.
 *
 * Used throughout the app to encourage sign-ups for specific actions.
 */
export function SignUpPrompt(props: SignUpPromptProps) {
	const variant = props.variant || 'inline'
	const { action } = props
	const { message } = props
	const getDefaultMessage = (): string => {
		if (message) {
			return message
		}

		if (
			typeof action === 'string' &&
			!['rsvp', 'like', 'comment', 'share', 'follow'].includes(action)
		) {
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
	const getActionText = (actionValue: string | undefined): string => {
		if (!actionValue) {
			return 'continue'
		}

		if (
			typeof actionValue === 'string' &&
			!['rsvp', 'like', 'comment', 'share', 'follow'].includes(actionValue)
		) {
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
					<Button
						onClick={props.onSignUp}
						variant="ghost"
						size="sm"
						className="text-primary-600 hover:text-primary-700 hover:underline font-medium h-auto p-0">
						Sign up
					</Button>
				) : (
					<Link
						to="/login"
						className="text-primary-600 hover:text-primary-700 hover:underline font-medium">
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
