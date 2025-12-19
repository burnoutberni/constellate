import type { ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'

import { Container } from '@/components/layout'
import { Button } from '@/components/ui'
import { isDevelopment } from '@/lib/env'

interface ErrorPageProps {
	error?: Error
	errorInfo?: ErrorInfo | null
	resetErrorBoundary?: () => void
}

export function ErrorPage({ error, errorInfo, resetErrorBoundary }: ErrorPageProps) {
	const navigate = useNavigate()

	const handleRetry = () => {
		if (resetErrorBoundary) {
			resetErrorBoundary()
		} else {
			// Fallback: reload the page if resetErrorBoundary is not provided
			window.location.reload()
		}
	}

	const handleGoHome = () => {
		if (resetErrorBoundary) {
			resetErrorBoundary()
		}
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

				{error && isDevelopment() && (
					<details className="mb-8 text-left">
						<summary className="cursor-pointer text-sm font-semibold text-error-700 dark:text-error-300 mb-2 hover:text-error-800 dark:hover:text-error-200">
							Error Details
						</summary>
						<div className="mt-4 space-y-4 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
							<div>
								<div className="text-xs font-semibold text-error-800 dark:text-error-200 mb-2">
									Error Message:
								</div>
								<code className="text-sm text-error-700 dark:text-error-300 font-mono block">
									{error.message}
								</code>
							</div>
							{error.stack && (
								<div>
									<div className="text-xs font-semibold text-error-800 dark:text-error-200 mb-2">
										Error Stack:
									</div>
									<code className="text-xs text-error-700 dark:text-error-300 font-mono whitespace-pre block overflow-auto max-h-64">
										{error.stack}
									</code>
								</div>
							)}
							{errorInfo?.componentStack && (
								<div>
									<div className="text-xs font-semibold text-error-800 dark:text-error-200 mb-2">
										Component Stack:
									</div>
									<code className="text-xs text-error-700 dark:text-error-300 font-mono whitespace-pre block overflow-auto max-h-64">
										{errorInfo.componentStack}
									</code>
								</div>
							)}
						</div>
					</details>
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
