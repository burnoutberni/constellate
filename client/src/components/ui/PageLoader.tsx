import { Spinner } from './Spinner'
import { cn } from '../../lib/utils'

export interface PageLoaderProps {
	/**
	 * Optional message to display below the spinner
	 */
	message?: string
	/**
	 * Additional CSS classes to apply to the container
	 */
	className?: string
	/**
	 * Size of the spinner
	 * @default 'lg'
	 */
	spinnerSize?: 'sm' | 'md' | 'lg'
}

/**
 * PageLoader component for displaying full-page loading states.
 * Centers a spinner on the screen with optional loading message.
 * Use this for initial page loads or major data fetching operations.
 */
export function PageLoader({ message, className, spinnerSize = 'lg' }: PageLoaderProps) {
	return (
		<div
			className={cn('flex flex-col items-center justify-center min-h-screen', className)}
			role="status"
			aria-label={message || 'Loading page'}
			aria-live="polite">
			<Spinner size={spinnerSize} />
			{message && <p className="mt-4 text-text-secondary text-sm">{message}</p>}
		</div>
	)
}
