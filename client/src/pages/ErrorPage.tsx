import { useNavigate } from 'react-router-dom'

import { Container } from '@/components/layout'
import { Button } from '@/components/ui'

interface ErrorPageProps {
	error?: Error
	resetErrorBoundary?: () => void
}

export function ErrorPage({ error, resetErrorBoundary }: ErrorPageProps) {
	const navigate = useNavigate()

	const handleRetry = () => {
		resetErrorBoundary?.()
		navigate(0) // Reload page
	}

	const handleGoHome = () => {
		resetErrorBoundary?.()
		navigate('/')
	}

	return (
		<div className="min-h-screen bg-background-secondary flex items-center justify-center">
			<Container size="sm" className="text-center py-16">
				<div className="mb-8 text-9xl">💥</div>
				<h1 className="text-4xl font-bold text-text-primary mb-4">Something went wrong</h1>
				<p className="text-lg text-text-secondary mb-8">
					An unexpected error occurred. Our team has been notified.
				</p>

				{error && (
					<div className="mb-8 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg text-left overflow-auto max-h-48">
						<code className="text-sm text-error-700 dark:text-error-300 font-mono">
							{error.message}
						</code>
					</div>
				)}

				<div className="flex gap-4 justify-center">
					<Button variant="primary" size="lg" onClick={handleRetry}>
						Try Again
					</Button>
					<Button variant="secondary" size="lg" onClick={handleGoHome}>
						Go Home
					</Button>
				</div>
			</Container>
		</div>
	)
}
