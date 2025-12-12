import React, { Component, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button } from './ui'
import { Container } from './layout'
import { logger } from '@/lib/logger'

export interface ErrorBoundaryProps {
	children: ReactNode
	fallback?: ReactNode
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
	resetKeys?: Array<string | number>
	resetOnPropsChange?: boolean
}

interface ErrorBoundaryState {
	hasError: boolean
	error: Error | null
	errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary component that catches React errors in the component tree
 * and displays a fallback UI with recovery options.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props)
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		}
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		}
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Log error
		logger.error('ErrorBoundary caught an error:', error, errorInfo)

		this.setState({
			error,
			errorInfo,
		})

		// Call optional error handler
		if (this.props.onError) {
			this.props.onError(error, errorInfo)
		}
	}

	componentDidUpdate(prevProps: ErrorBoundaryProps) {
		const { resetKeys, resetOnPropsChange } = this.props
		const { hasError } = this.state

		// Reset error boundary if resetKeys have changed
		if (hasError && resetKeys && prevProps.resetKeys) {
			const hasResetKeyChanged = resetKeys.some(
				(key, index) => key !== prevProps.resetKeys?.[index]
			)
			if (hasResetKeyChanged) {
				this.resetErrorBoundary()
			}
		}

		// Reset error boundary if resetOnPropsChange is true and props have changed
		if (hasError && resetOnPropsChange) {
			const propsChanged = Object.keys(this.props).some(
				(key) =>
					key !== 'children' &&
					this.props[key as keyof ErrorBoundaryProps] !==
						prevProps[key as keyof ErrorBoundaryProps]
			)
			if (propsChanged) {
				this.resetErrorBoundary()
			}
		}
	}

	resetErrorBoundary = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		})
	}

	render() {
		if (this.state.hasError) {
			// Use custom fallback if provided
			if (this.props.fallback) {
				return this.props.fallback
			}

			// Default fallback UI
			return (
				<Container size="lg" className="py-8">
					<Card variant="outlined" padding="lg">
						<CardHeader>
							<CardTitle className="text-error-700 dark:text-error-400">
								Something went wrong
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-text-secondary">
								We encountered an unexpected error. Don&apos;t worry, your data is
								safe.
							</p>

							{process.env.NODE_ENV === 'development' && this.state.error && (
								<details className="mt-4">
									<summary className="cursor-pointer text-sm font-medium text-text-secondary mb-2">
										Error Details (Development Only)
									</summary>
									<div className="mt-2 p-4 bg-background-secondary rounded-md">
										<p className="text-sm font-mono text-error-600 dark:text-error-400 mb-2">
											{this.state.error.toString()}
										</p>
										{this.state.errorInfo && (
											<pre className="text-xs text-text-secondary overflow-auto">
												{this.state.errorInfo.componentStack}
											</pre>
										)}
									</div>
								</details>
							)}

							<div className="flex gap-3 mt-6">
								<Button variant="primary" onClick={this.resetErrorBoundary}>
									Try Again
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										window.location.href = '/'
									}}>
									Go Home
								</Button>
							</div>
						</CardContent>
					</Card>
				</Container>
			)
		}

		return this.props.children
	}
}
